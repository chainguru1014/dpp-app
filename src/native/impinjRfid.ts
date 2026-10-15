// Thin wrapper around the Impinj R700 reader-service HTTP API — a small
// REST service (built with the Octane SDK, see /rfid-reader-service at the
// repo root). Plain HTTP, no auth, no TLS (per the API's own spec) — this is
// a trusted-network-only service, not a public endpoint.
//
// Unlike Yometel (phone-to-reader BLE, Android-only, per-employee MAC), this
// is platform-independent: it's just fetch() calls, so it works the same on
// web, iOS and Android. There's also only ever one Impinj reader (this
// fixed service address), not a per-employee reader id.

// The reader-service now runs on the same hosting server as this app/the
// DPP backend (previously a separate PC reachable only via Tailscale), so
// this is a same-host call rather than a public IP. Update this if the
// service ever moves to a different machine/port — nothing else in the app
// needs to change.
const IMPINJ_SERVICE_BASE_URL = 'http://localhost:5284';
export const IMPINJ_SERVICE_DISPLAY_ADDRESS = IMPINJ_SERVICE_BASE_URL.replace(/^https?:\/\//, '');

const REQUEST_TIMEOUT_MS = 8000;

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
// of repeating try/catch per call.
async function request<T>(method: string, path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${IMPINJ_SERVICE_BASE_URL}${path}`, { method, signal: controller.signal });
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

export const getImpinjReaderStatus = () => request<ImpinjReaderStatus>('GET', '/api/reader/status');
export const connectImpinjReader = () => request<ImpinjReaderStatus>('POST', '/api/reader/connect');
export const disconnectImpinjReader = () => request<ImpinjReaderStatus>('POST', '/api/reader/disconnect');
export const startImpinjReading = () => request<ImpinjReaderStatus>('POST', '/api/reader/start');
export const stopImpinjReading = () => request<ImpinjReaderStatus>('POST', '/api/reader/stop');

// Tags currently "in view" (seen within the service's ~10s window) — this is
// what the Passing Tags card polls, same role scanOnceYometel() plays for
// the Yometel branch.
export const getImpinjTagsInView = () => request<ImpinjTagRead[]>('GET', '/api/tags');
export const getImpinjRecentTags = (count = 100) => request<ImpinjTagRead[]>('GET', `/api/tags/recent?count=${count}`);
export const clearImpinjTags = () => request<void>('DELETE', '/api/tags');
