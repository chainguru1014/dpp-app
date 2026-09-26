import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';

// Thin wrapper around the native YometelRfidModule (Android only for now —
// see android/app/src/main/java/com/yometel/dpp/rfid). The native side only
// moves bytes/lines over BLE (FdcBleTransport); the Yometel ASCII command
// protocol itself (RFVER/C1GEN2XX/etc., per the Yometel SW manual) is parsed
// here, matching the project's "transport in Kotlin, protocol in TypeScript"
// split — easier to test/iterate on the protocol without a rebuild.

export interface YometelRfidTag {
  epc: string;
  seenAt: string;
}

const CONNECT_TIMEOUT_MS = 20000;
const COMMAND_TIMEOUT_MS = 4000;

const nativeModule = () => NativeModules.YometelRfidModule;

const isAndroid = Platform.OS === 'android';

// Single-outstanding-request model: the reader only ever has one command in
// flight at a time (matches how it's actually used — send a scan, wait for
// its response line, send the next one), so a plain FIFO queue of pending
// resolvers is enough; no per-command correlation id needed.
let pendingLine: { resolve: (line: string) => void; reject: (err: Error) => void } | null = null;
let scanInFlight = false;

let lineSubscription: any = null;
let errorSubscription: any = null;
let debugSubscription: any = null;

// Debug/timeline feed for the in-app "Connect" debug dialog
// (CorporateScannerScreen.tsx) — every native BLE-handshake step arrives
// here via YometelRfidDebug, alongside the JS-layer's own protocol-level
// TX/RX lines, so the dialog can show one ordered log of "what's actually
// happening" without the UI needing to know about the native event names.
type DebugListener = (message: string) => void;
const debugListeners = new Set<DebugListener>();

export function subscribeYometelDebug(callback: DebugListener): () => void {
  debugListeners.add(callback);
  return () => {
    debugListeners.delete(callback);
  };
}

function debugLog(message: string) {
  debugListeners.forEach((listener) => listener(message));
}

function ensureListening() {
  if (lineSubscription) return;
  lineSubscription = DeviceEventEmitter.addListener('YometelRfidLine', (e: { line: string }) => {
    const waiter = pendingLine;
    pendingLine = null;
    waiter?.resolve(e.line);
  });
  errorSubscription = DeviceEventEmitter.addListener('YometelRfidError', (e: { message?: string }) => {
    const waiter = pendingLine;
    pendingLine = null;
    waiter?.reject(new Error(e?.message || 'RFID reader error'));
  });
  debugSubscription = DeviceEventEmitter.addListener('YometelRfidDebug', (e: { message?: string }) => {
    if (e?.message) debugLog(e.message);
  });
}

function sendAndAwaitLine(command: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<string> {
  ensureListening();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingLine === entry) {
        pendingLine = null;
        debugLog(`Timed out waiting for response to "${command}"`);
        reject(new Error(`Timed out waiting for reader response to "${command}"`));
      }
    }, timeoutMs);
    const entry = {
      resolve: (line: string) => {
        clearTimeout(timer);
        debugLog(`RX: ${line}`);
        resolve(line);
      },
      reject: (err: Error) => {
        clearTimeout(timer);
        reject(err);
      },
    };
    pendingLine = entry;
    debugLog(`TX: ${command}`);
    nativeModule()
      .sendCommand(command)
      .catch((err: Error) => {
        if (pendingLine === entry) {
          pendingLine = null;
          clearTimeout(timer);
          debugLog(`Failed to send "${command}": ${err?.message || err}`);
          reject(err);
        }
      });
  });
}

export async function connectYometelReader(macAddress: string): Promise<void> {
  if (!isAndroid || !nativeModule()) {
    throw new Error('Yometel RFID reader support is Android-only for now.');
  }
  ensureListening();
  debugLog(`Requesting connect to ${macAddress}`);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      connectedSub.remove();
      failedSub.remove();
      debugLog(`Timed out waiting for connect (${CONNECT_TIMEOUT_MS}ms)`);
      reject(new Error('Timed out connecting to the RFID reader'));
    }, CONNECT_TIMEOUT_MS);
    const connectedSub = DeviceEventEmitter.addListener('YometelRfidConnected', () => {
      clearTimeout(timer);
      connectedSub.remove();
      failedSub.remove();
      resolve();
    });
    const failedSub = DeviceEventEmitter.addListener('YometelRfidError', (e: { message?: string }) => {
      clearTimeout(timer);
      connectedSub.remove();
      failedSub.remove();
      reject(new Error(e?.message || 'Failed to connect to the RFID reader'));
    });
    nativeModule()
      .connect(macAddress)
      .catch((err: Error) => {
        clearTimeout(timer);
        connectedSub.remove();
        failedSub.remove();
        reject(err);
      });
  });

  // Protocol init (chk_dig=1: no check-digit suffix on EPCs; tag_num=10 is
  // just the "expected minimum tags" hint the manual describes — not a hard
  // limit). Best-effort: a slow/odd init response shouldn't block Connect
  // from having succeeded at the BLE level.
  try {
    await sendAndAwaitLine('C1GEN2I 1,10');
  } catch (err: any) {
    debugLog(`C1GEN2I init did not respond as expected: ${err?.message || err}`);
    console.warn('Yometel C1GEN2I init did not respond as expected:', err);
  }
}

export async function disconnectYometelReader(): Promise<void> {
  if (!isAndroid || !nativeModule()) return;
  debugLog('Requesting disconnect');
  pendingLine?.reject(new Error('Disconnected'));
  pendingLine = null;
  await nativeModule().disconnect();
}

// Response shape per the Yometel SW manual's C1GEN2XX command:
//   "0000,OK"                      -> no tags in range
//   "0001,3034257BF400A0C0...,OK"  -> one or more tags, comma-separated
function parseScanLine(line: string): string[] {
  const parts = line.split(',').map((p) => p.trim());
  if (parts.length === 0) return [];
  if (parts[parts.length - 1].toUpperCase() !== 'OK') return [];
  const count = parts[0];
  if (count === '0000') return [];
  // Everything between the count and the trailing OK is an EPC.
  return parts.slice(1, parts.length - 1).filter((epc) => epc.length > 0);
}

/**
 * Sends one C1GEN2XX scan and resolves with whatever tags are currently in
 * range. Guarded against overlapping calls — if the app's poll timer fires
 * again before a previous scan's BLE round-trip finished, the new call just
 * resolves empty rather than queueing up (the next tick will try again).
 */
export async function scanOnceYometel(): Promise<YometelRfidTag[]> {
  if (scanInFlight) return [];
  scanInFlight = true;
  try {
    const line = await sendAndAwaitLine('C1GEN2XX 0,0');
    const epcs = parseScanLine(line);
    const seenAt = new Date().toISOString();
    return epcs.map((epc) => ({ epc, seenAt }));
  } finally {
    scanInFlight = false;
  }
}
