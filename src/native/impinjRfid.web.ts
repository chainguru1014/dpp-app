import { API_BASE_URL } from '../config/api';
import {
  ImpinjReaderStatus,
  ImpinjTagRead,
  ImpinjReaderSettings,
} from './impinjRfidShared';

export * from './impinjRfidShared';

// Plain browser: a web page can't open a raw TCP/LLRP socket to the reader's
// LAN IP, so this goes through the DPP backend's /impinj-llrp/* routes
// (backend/controllers/impinjLlrpController.ts), which speak LLRP directly
// to the reader and hand back JSON matching the shapes in impinjRfidShared.ts.
//
// Desktop app (Electron, see /desktop at the repo root): this same web build
// runs inside it too, but its main process *is* real Node — it can and does
// open that socket directly (desktop/impinjLlrpMain.js, no backend, no
// Tailscale needed as long as the desktop machine is on the reader's own
// network). desktop/preload.js exposes that as window.electronImpinj; when
// present, every export below calls straight through to it instead of
// fetching the backend. CorporateScannerScreen.tsx/ShipmentInspectionScreen.tsx
// don't know or care which path is active — same contract either way.
//
// The native mobile build (impinjRfid.ts) connects straight to the reader
// from the phone itself the same way, for the same reason.
declare global {
  interface Window {
    electronImpinj?: {
      getStatus: () => Promise<ImpinjReaderStatus>;
      connect: () => Promise<ImpinjReaderStatus>;
      disconnect: () => Promise<ImpinjReaderStatus>;
      start: () => Promise<ImpinjReaderStatus>;
      stop: () => Promise<ImpinjReaderStatus>;
      getTagsInView: () => Promise<ImpinjTagRead[]>;
      getRecentTags: (count?: number) => Promise<ImpinjTagRead[]>;
      clearTags: () => Promise<void>;
      getSettings: () => Promise<ImpinjReaderSettings>;
      updateSettings: (next: ImpinjReaderSettings) => Promise<ImpinjReaderSettings>;
    };
  }
}
const electronBridge = typeof window !== 'undefined' ? window.electronImpinj : undefined;

// Kept comfortably above the backend's own worst case (impinjLlrpController.ts):
// its own CONNECT/TRANSACT timeouts stack up across a start() sequence, so
// the app needs to wait at least that long before giving up itself, or it'll
// show its own timeout before the backend's real answer ever arrives.
const REQUEST_TIMEOUT_MS = 45000;

// Every endpoint shares the same shape of concerns (timeout, non-2xx ->
// {error}, 204 -> no body), so it's all funneled through one helper instead
// of repeating try/catch per call. Path is relative to API_BASE_URL, which
// already includes a trailing slash (see config/api.ts).
async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}impinj-llrp/${path}`, {
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

export const getImpinjReaderStatus = () => electronBridge ? electronBridge.getStatus() : request<ImpinjReaderStatus>('GET', 'status');
export const connectImpinjReader = () => electronBridge ? electronBridge.connect() : request<ImpinjReaderStatus>('POST', 'connect');
export const disconnectImpinjReader = () => electronBridge ? electronBridge.disconnect() : request<ImpinjReaderStatus>('POST', 'disconnect');
export const startImpinjReading = () => electronBridge ? electronBridge.start() : request<ImpinjReaderStatus>('POST', 'start');
export const stopImpinjReading = () => electronBridge ? electronBridge.stop() : request<ImpinjReaderStatus>('POST', 'stop');

// Tags currently "in view" (seen within the service's ~10s window) — this is
// what the Passing Tags card polls, same role scanOnceYometel() plays for
// the Yometel branch.
export const getImpinjTagsInView = () => electronBridge ? electronBridge.getTagsInView() : request<ImpinjTagRead[]>('GET', 'tags');
export const getImpinjRecentTags = (count = 100) => electronBridge ? electronBridge.getRecentTags(count) : request<ImpinjTagRead[]>('GET', `tags/recent?count=${count}`);
export const clearImpinjTags = () => electronBridge ? electronBridge.clearTags() : request<void>('DELETE', 'tags');

export const getImpinjReaderSettings = () => electronBridge ? electronBridge.getSettings() : request<ImpinjReaderSettings>('GET', 'settings');
export const updateImpinjReaderSettings = (settings: ImpinjReaderSettings) =>
  electronBridge ? electronBridge.updateSettings(settings) : request<ImpinjReaderSettings>('PUT', 'settings', settings);
