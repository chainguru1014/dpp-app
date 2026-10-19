// Types shared by impinjRfid.ts (native: direct LLRP/TCP to the reader) and
// impinjRfid.web.ts (web: can't open a raw TCP socket from a browser, so it
// goes through the DPP backend's /impinj-llrp/* routes instead). Both files
// re-export everything here so screens keep importing from '../native/impinjRfid'
// without needing to know which implementation backs it.
export const IMPINJ_READER_DISPLAY_NAME = 'Impinj R700 (fixed reader)';

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
  antennaPort: number | null;
  peakRssiInDbm: number | null;
  tagSeenCount: number | null;
  firstSeenTimeUtc: string | null;
  lastSeenTimeUtc: string | null;
  phaseAngleInRadians: number | null;
}

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

// Initial/fallback values shown in the settings form before real settings
// have loaded (web: before the backend GET resolves; native: before
// AsyncStorage has been read), so the form is never blank.
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
