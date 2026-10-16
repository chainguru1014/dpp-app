import { API_BASE_URL } from '../config/api';

// Thin wrapper around the Impinj R700 reader-service — a small Octane SDK
// HTTP API (see /rfid-reader-service at the repo root) running on the same
// hosting server as the DPP backend.
//
// This does NOT call the reader-service directly from the app. The app runs
// on a staff member's own phone/browser, where "localhost" would resolve to
// that device, not the server — so calling the reader-service's own
// localhost:5284 address from here can never reach it. Instead this goes
// through the DPP backend's /impinj/* routes (backend/controllers/
// impinjController.ts), which run ON that same server and proxy straight
// through to the reader-service's documented API one-for-one.
//
// Unlike Yometel (phone-to-reader BLE, Android-only, per-employee MAC), this
// is platform-independent — plain fetch() to the regular backend, so it
// works the same on web, iOS and Android. There's also only ever one Impinj
// reader (one fixed backend), not a per-employee reader id.
export const IMPINJ_READER_DISPLAY_NAME = 'Impinj R700 (fixed reader)';

// Kept comfortably above the backend's own worst case (impinjController.ts):
// REQUEST_TIMEOUT_MS (20s) * up to 2 attempts for start()'s retry + the 2s
// gap between them = ~42s — so the app needs to wait at least that long
// before giving up itself, or it'll show its own timeout before the
// backend's real answer (success or failure) ever arrives.
const REQUEST_TIMEOUT_MS = 45000;

export interface ImpinjReaderStatus {
  isConnected: boolean;
  isStarted: boolean;
  address: string | null;
  firmwareVersion: string | null;
  modelName: string | null;
  temperatureInCelsius: number | null;
  lastError: string | null;
  lastErrorAtUtc: string | null;
}

export interface ImpinjTagRead {
  epc: string;
  antennaPort: number;
  peakRssiInDbm: number | null;
  tagSeenCount: number | null;
  firstSeenTimeUtc: string | null;
  lastSeenTimeUtc: string | null;
  phaseAngleInRadians: number | null;
}

// Reader connection settings — proposed contract against the reader-
// service's GET/PUT /api/reader/settings (not yet confirmed against the
// actual .NET implementation; see rfid-reader-service's handoff notes for
// the exact spec this was designed against). availableAntennaPorts is
// populated by the reader-service once it knows the hardware's real
// capabilities (e.g. after a successful connect) — the settings UI only
// shows antenna selection when this is present, per "if capabilities are
// available".
export interface ImpinjInventorySettings {
  rfMode?: number | null;
  searchMode?: string | null;
  session?: number | null;
  powerDbm?: number | null;
}

export interface ImpinjReaderSettings {
  readerName: string;
  ipAddress: string;
  port: number;
  connectionTimeoutMs: number;
  autoReconnect: boolean;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
  unlimitedReconnectAttempts: boolean;
  autoConnectOnStartup: boolean;
  availableAntennaPorts?: number[] | null;
  enabledAntennaPorts?: number[] | null;
  inventorySettings?: ImpinjInventorySettings;
}

// Initial/fallback values given for this feature — shown in the settings
// form before the reader-service's actual current settings have loaded
// (or if that GET fails), so the form is never blank.
export const IMPINJ_DEFAULT_READER_SETTINGS: ImpinjReaderSettings = {
  readerName: 'Main RFID Reader',
  ipAddress: '192.168.1.10',
  port: 5084,
  connectionTimeoutMs: 10000,
  autoReconnect: true,
  reconnectIntervalMs: 5000,
  maxReconnectAttempts: 10,
  unlimitedReconnectAttempts: false,
  autoConnectOnStartup: true,
};

// Every endpoint shares the same shape of concerns (timeout, non-2xx ->
// {error}, 204 -> no body), so it's all funneled through one helper instead
// of repeating try/catch per call. Path is relative to API_BASE_URL, which
// already includes a trailing slash (see config/api.ts).
async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}impinj/${path}`, {
      method,
      signal: controller.signal,
      ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch (err: any) {
    throw new Error(
      err?.name === 'AbortError'
        ? 'Timed out reaching the Impinj reader service'
        : err?.message || 'Could not reach the Impinj reader service'
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Impinj reader service error (HTTP ${res.status})`);
  }
  return data as T;
}

export const getImpinjReaderStatus = () => request<ImpinjReaderStatus>('GET', 'status');
export const connectImpinjReader = () => request<ImpinjReaderStatus>('POST', 'connect');
export const disconnectImpinjReader = () => request<ImpinjReaderStatus>('POST', 'disconnect');
export const startImpinjReading = () => request<ImpinjReaderStatus>('POST', 'start');
export const stopImpinjReading = () => request<ImpinjReaderStatus>('POST', 'stop');

// Tags currently "in view" (seen within the service's ~10s window) — this is
// what the Passing Tags card polls, same role scanOnceYometel() plays for
// the Yometel branch.
export const getImpinjTagsInView = () => request<ImpinjTagRead[]>('GET', 'tags');
export const getImpinjRecentTags = (count = 100) => request<ImpinjTagRead[]>('GET', `tags/recent?count=${count}`);
export const clearImpinjTags = () => request<void>('DELETE', 'tags');

export const getImpinjReaderSettings = () => request<ImpinjReaderSettings>('GET', 'settings');
export const updateImpinjReaderSettings = (settings: ImpinjReaderSettings) =>
  request<ImpinjReaderSettings>('PUT', 'settings', settings);
