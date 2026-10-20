import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ImpinjReaderStatus,
  ImpinjTagRead,
  ImpinjReaderSettings,
  IMPINJ_DEFAULT_READER_SETTINGS,
} from './impinjRfidShared';

export * from './impinjRfidShared';

// Native build (Android/iOS): connects straight to the Impinj R700 over
// LLRP/TCP from the phone itself, instead of going through the DPP backend
// (impinjRfid.web.ts's approach — a browser can't open a raw TCP socket, but
// a phone on the same WiFi as the reader can). Uses the same `llrpjs`
// package backend/controllers/impinjLlrpController.ts uses, pointed at
// react-native-tcp-socket instead of Node's own `net` module via this
// project's package.json "react-native": {"net": "react-native-tcp-socket"}
// override (see react-native-tcp-socket's own docs for why that works:
// it's built to be a drop-in replacement for exactly this kind of reuse).
//
// This mirrors impinjLlrpController.ts's logic closely on purpose — same
// ROSpec, same tag dedup-by-EPC + 10s "in view" window, same always-200
// status-object-not-a-thrown-error contract — so CorporateScannerScreen.tsx
// and ShipmentInspectionScreen.tsx behave identically regardless of which
// file is actually running underneath.
const { LLRPClient, LLRPCore } = require('llrpjs');

const SETTINGS_STORAGE_KEY = 'impinjReaderSettings';
const ROSPEC_ID = 123;
const CONNECT_TIMEOUT_MS = 8000;
const TRANSACT_TIMEOUT_MS = 8000;
const TAG_IN_VIEW_WINDOW_MS = 10000;

let settings: ImpinjReaderSettings = { ...IMPINJ_DEFAULT_READER_SETTINGS };
let settingsLoaded = false;

async function loadSettings(): Promise<ImpinjReaderSettings> {
  if (settingsLoaded) return settings;
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch {
    // Fall back to defaults — the settings form will just show them.
  }
  settingsLoaded = true;
  return settings;
}

let client: any = null;
let connected = false;
let started = false;
let lastError: string | null = null;
let lastErrorAtUtc: string | null = null;

function recordError(message: string) {
  lastError = message;
  lastErrorAtUtc = new Date().toISOString();
}

// llrpjs errors carry only a code in `name` (e.g. new LLRPError(
// "ERR_LLRP_READER_TIMEOUT") has an empty message), so turn the common ones
// into something a worker can act on instead of a blank generic failure.
function describeLlrpError(error: any, fallback: string): string {
  const code = error?.name || error?.code || '';
  const where = settings.ipAddress ? `${settings.ipAddress}:${settings.port}` : 'the reader';
  if (code === 'ERR_LLRP_READER_TIMEOUT') {
    return `The reader at ${where} did not answer in time. Check that it is on, in LLRP mode, and that no other app is connected to it.`;
  }
  if (code === 'ERR_LLRP_READER_OFFLINE') {
    return `Lost the connection to the reader at ${where}.`;
  }
  const message = error?.message || (typeof error === 'string' ? error : '');
  if (/ECONNREFUSED|refused/i.test(message)) {
    return `The reader at ${where} refused the connection. Check that its RFID interface is set to LLRP.`;
  }
  if (/EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|timed out|unreachable/i.test(message)) {
    return `Could not reach ${where}. Check that this phone is on the same WiFi as the reader.`;
  }
  return message || (code && code !== 'Error' ? `${fallback} (${code})` : fallback);
}

function buildStatus(): ImpinjReaderStatus {
  return {
    isConnected: connected && !!client?.socketWritable,
    isStarted: started,
    address: settings.ipAddress ? `${settings.ipAddress}:${settings.port}` : null,
    firmwareVersion: null,
    modelName: null,
    temperatureInCelsius: null,
    lastError,
    lastErrorAtUtc,
  };
}

// LLRP timestamps arrive as microseconds-since-epoch (possibly a BigInt via
// llrpjs's json-bigint dependency) — Number() handles both cleanly.
function microsToIso(micros: any): string | null {
  if (micros == null) return null;
  try {
    return new Date(Number(micros) / 1000).toISOString();
  } catch {
    return null;
  }
}
function microsFromTimestampParam(param: any): any {
  return param?.getMicroseconds ? param.getMicroseconds() : undefined;
}

// Minimal "read everything, report immediately" ROSpec — same as
// impinjLlrpController.ts's. AntennaIDs: [0] means "all antennas".
function buildRoSpec() {
  return new LLRPCore.ROSpec({
    data: {
      ROSpecID: ROSPEC_ID,
      Priority: 0,
      CurrentState: 'Disabled',
      ROBoundarySpec: {
        ROSpecStartTrigger: { ROSpecStartTriggerType: 'Null' },
        ROSpecStopTrigger: { ROSpecStopTriggerType: 'Null', DurationTriggerValue: 0 },
      },
      AISpec: {
        AntennaIDs: [0],
        AISpecStopTrigger: { AISpecStopTriggerType: 'Null', DurationTrigger: 0 },
        InventoryParameterSpec: { InventoryParameterSpecID: 1234, ProtocolID: 'EPCGlobalClass1Gen2' },
      },
      ROReportSpec: {
        ROReportTrigger: 'Upon_N_Tags_Or_End_Of_AISpec',
        N: 1,
        TagReportContentSelector: {
          EnableROSpecID: false,
          EnableSpecIndex: false,
          EnableInventoryParameterSpecID: false,
          EnableAntennaID: true,
          EnableChannelIndex: false,
          EnablePeakRSSI: true,
          EnableFirstSeenTimestamp: true,
          EnableLastSeenTimestamp: true,
          EnableTagSeenCount: false,
          EnableAccessSpecID: false,
        },
      },
    },
  });
}

// Keyed by EPC, not an append log — the reader re-reports the same tag on
// every inventory round while it's in range (see impinjLlrpController.ts's
// commit message for the duplicate-rows bug this avoids).
type TagEntry = ImpinjTagRead & { _lastSeenAtMs: number };
let tagsByEpc = new Map<string, TagEntry>();

function stripInternal(tag: TagEntry): ImpinjTagRead {
  const { _lastSeenAtMs, ...rest } = tag;
  return rest;
}

function attachTagReportListener(reader: any) {
  reader.on('RO_ACCESS_REPORT', (msg: any) => {
    let list = msg.getTagReportData();
    if (!Array.isArray(list)) list = [list];
    const nowMs = Date.now();
    for (const tagReportData of list) {
      const epc = tagReportData.getEPCParameter?.()?.getEPC?.();
      if (!epc) continue;
      const existing = tagsByEpc.get(epc);
      const lastSeenTimeUtc =
        microsToIso(microsFromTimestampParam(tagReportData.getLastSeenTimestampUTC?.())) ||
        new Date(nowMs).toISOString();
      tagsByEpc.set(epc, {
        epc,
        antennaPort: tagReportData.getAntennaID?.()?.getAntennaID?.() ?? null,
        peakRssiInDbm: tagReportData.getPeakRSSI?.()?.getPeakRSSI?.() ?? null,
        tagSeenCount: null,
        // Kept from the first sighting, not overwritten on repeat reads.
        firstSeenTimeUtc:
          existing?.firstSeenTimeUtc ??
          microsToIso(microsFromTimestampParam(tagReportData.getFirstSeenTimestampUTC?.())) ??
          lastSeenTimeUtc,
        lastSeenTimeUtc,
        phaseAngleInRadians: null,
        _lastSeenAtMs: nowMs,
      });
    }
  });
  // The reader expects a KEEPALIVE_ACK promptly or it may drop the
  // connection as unresponsive.
  reader.on('KEEPALIVE', () => {
    reader.send(new LLRPCore.KEEPALIVE_ACK());
  });
  reader.on('disconnect', () => {
    connected = false;
    started = false;
  });
  reader.on('error', () => {
    connected = false;
    started = false;
  });
}

async function ensureConnected() {
  if (connected && client?.socketWritable) return client;
  await loadSettings();
  if (!settings.ipAddress) {
    throw new Error('No reader IP address configured — set it via the RFID settings icon.');
  }

  // A socket left open by an earlier failed attempt would hold the reader's
  // single LLRP client slot and make every retry fail, so close it first.
  if (client?.socketWritable) {
    await client.disconnect().catch(() => {});
  }
  client = new LLRPClient({ host: settings.ipAddress, port: settings.port });
  attachTagReportListener(client);
  await client.connect();

  try {
    // The reader sends a READER_EVENT_NOTIFICATION right after the TCP
    // handshake to confirm the LLRP session itself succeeded (a bad
    // ConnectionAttemptEvent status here means "connected" at TCP level but
    // rejected at the protocol level, e.g. another client already holds
    // exclusive access).
    const notif = await client.recv(CONNECT_TIMEOUT_MS);
    if (!(notif instanceof LLRPCore.READER_EVENT_NOTIFICATION)) {
      throw new Error(`Unexpected message while confirming connection: ${notif?.getName?.() ?? notif}`);
    }
    const status = notif.getReaderEventNotificationData().getConnectionAttemptEvent()?.getStatus();
    if (status !== 'Success') {
      throw new Error(`Reader rejected the LLRP connection: ${status}`);
    }
  } catch (error) {
    await client.disconnect().catch(() => {});
    throw error;
  }

  connected = true;
  return client;
}

// status never attempts a connection itself — screens call this first,
// specifically to check current state before deciding whether to call
// connect() (see CorporateScannerScreen.tsx's handleConnectPress), so this
// just reflects in-memory state.
export const getImpinjReaderStatus = async (): Promise<ImpinjReaderStatus> => {
  await loadSettings();
  return buildStatus();
};

export const connectImpinjReader = async (): Promise<ImpinjReaderStatus> => {
  try {
    await ensureConnected();
  } catch (error: any) {
    recordError(describeLlrpError(error, 'Could not connect to the Impinj R700 reader over LLRP'));
  }
  return buildStatus();
};

export const disconnectImpinjReader = async (): Promise<ImpinjReaderStatus> => {
  try {
    if (client?.socketWritable) {
      await client.transact(new LLRPCore.CLOSE_CONNECTION(), TRANSACT_TIMEOUT_MS).catch(() => null);
      await client.disconnect();
    }
  } catch (error: any) {
    recordError(describeLlrpError(error, 'Could not disconnect from the Impinj R700 reader'));
  } finally {
    connected = false;
    started = false;
  }
  return buildStatus();
};

export const startImpinjReading = async (): Promise<ImpinjReaderStatus> => {
  try {
    const reader = await ensureConnected();
    // Clean slate — an already-added ROSpec from a prior session (crash,
    // app reload) would otherwise make ADD_ROSPEC fail.
    await reader.transact(new LLRPCore.DELETE_ROSPEC({ data: { ROSpecID: 0 } }), TRANSACT_TIMEOUT_MS);

    const roSpec = buildRoSpec();
    const addRsp = await reader.transact(new LLRPCore.ADD_ROSPEC().setROSpec(roSpec), TRANSACT_TIMEOUT_MS);
    const addStatus = addRsp?.getLLRPStatus?.()?.getStatusCode?.();
    if (addStatus && addStatus !== 'M_Success') {
      throw new Error(`ADD_ROSPEC failed: ${addStatus}`);
    }

    await reader.transact(new LLRPCore.ENABLE_ROSPEC({ data: { ROSpecID: ROSPEC_ID } }), TRANSACT_TIMEOUT_MS);
    const startRsp = await reader.transact(new LLRPCore.START_ROSPEC({ data: { ROSpecID: ROSPEC_ID } }), TRANSACT_TIMEOUT_MS);
    const startStatus = startRsp?.getLLRPStatus?.()?.getStatusCode?.();
    if (startStatus && startStatus !== 'M_Success') {
      throw new Error(`START_ROSPEC failed: ${startStatus}`);
    }

    tagsByEpc = new Map();
    started = true;
  } catch (error: any) {
    started = false;
    recordError(describeLlrpError(error, 'Could not start the Impinj R700 reader over LLRP'));
  }
  return buildStatus();
};

export const stopImpinjReading = async (): Promise<ImpinjReaderStatus> => {
  try {
    const reader = await ensureConnected();
    await reader.transact(new LLRPCore.STOP_ROSPEC({ data: { ROSpecID: ROSPEC_ID } }), TRANSACT_TIMEOUT_MS);
    await reader.transact(new LLRPCore.DELETE_ROSPEC({ data: { ROSpecID: ROSPEC_ID } }), TRANSACT_TIMEOUT_MS);
  } catch (error: any) {
    recordError(describeLlrpError(error, 'Could not stop the Impinj R700 reader over LLRP'));
  } finally {
    started = false;
  }
  return buildStatus();
};

// "Currently in view" — only tags re-read within the last
// TAG_IN_VIEW_WINDOW_MS, newest-first. This is what the Passing Tags card
// polls, same role scanOnceYometel() plays for the Yometel branch.
export const getImpinjTagsInView = async (): Promise<ImpinjTagRead[]> => {
  const cutoff = Date.now() - TAG_IN_VIEW_WINDOW_MS;
  return Array.from(tagsByEpc.values())
    .filter((t) => t._lastSeenAtMs >= cutoff)
    .sort((a, b) => b._lastSeenAtMs - a._lastSeenAtMs)
    .map(stripInternal);
};

// Full history since the last start()/clear, not windowed — every distinct
// EPC seen this session, newest-first, capped to `count`.
export const getImpinjRecentTags = async (count = 100): Promise<ImpinjTagRead[]> => {
  return Array.from(tagsByEpc.values())
    .sort((a, b) => b._lastSeenAtMs - a._lastSeenAtMs)
    .slice(0, count)
    .map(stripInternal);
};

export const clearImpinjTags = async (): Promise<void> => {
  tagsByEpc = new Map();
};

export const getImpinjReaderSettings = async (): Promise<ImpinjReaderSettings> => {
  return { ...(await loadSettings()) };
};

export const updateImpinjReaderSettings = async (next: ImpinjReaderSettings): Promise<ImpinjReaderSettings> => {
  await loadSettings();
  const addressChanged = next.ipAddress !== settings.ipAddress || next.port !== settings.port;
  settings = { ...settings, ...next };
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal — settings just won't survive an app restart this time.
  }
  // A live LLRP session can't be repointed at a different host/port — drop
  // it so the next connect() uses the new address instead of silently
  // staying connected to the old one.
  if (addressChanged && client?.socketWritable) {
    await client.disconnect().catch(() => {});
    connected = false;
    started = false;
  }
  return { ...settings };
};
