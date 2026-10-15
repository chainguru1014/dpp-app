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

// Kept a few seconds above the backend's own REQUEST_TIMEOUT_MS
// (backend/controllers/impinjController.ts) — the backend's call to the
// reader-service can legitimately take a while (the Octane SDK talking live
// to the physical R700, not just cached state), so the app needs to wait
// at least that long before giving up itself, or it'll show its own timeout
// before the backend's real answer (success or failure) ever arrives.
const REQUEST_TIMEOUT_MS = 25000;

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

// Every endpoint shares the same shape of concerns (timeout, non-2xx ->
// {error}, 204 -> no body), so it's all funneled through one helper instead
// of repeating try/catch per call. Path is relative to API_BASE_URL, which
// already includes a trailing slash (see config/api.ts).
async function request<T>(method: string, path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}impinj/${path}`, { method, signal: controller.signal });
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
