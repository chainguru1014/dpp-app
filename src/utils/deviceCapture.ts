import { Platform } from 'react-native';

// Same defensive conditionally-required pattern used for the native scanner
// libraries elsewhere in this app — degrades gracefully (best-effort blank)
// instead of crashing if these haven't been linked/rebuilt yet.
let Geolocation: any = null;
try {
  Geolocation = require('react-native-geolocation-service');
} catch (e) {
  console.warn('react-native-geolocation-service not available:', e);
}

let DeviceInfo: any = null;
try {
  DeviceInfo = require('react-native-device-info');
} catch (e) {
  console.warn('react-native-device-info not available:', e);
}

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface CapturedDevice {
  model: string;
  os: string;
  osVersion: string;
}

// Best-effort GPS fix for the corporate capture flow. Never throws — returns
// null on missing permission, unavailable hardware, timeout, or (on web) no
// Geolocation API. Mirrors how ScanRecord.location already degrades today.
export const getCurrentLocation = (): Promise<CapturedLocation | null> => {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const geo = (globalThis as any)?.navigator?.geolocation;
      if (!geo) {
        resolve(null);
        return;
      }
      geo.getCurrentPosition(
        (pos: any) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
      return;
    }

    if (!Geolocation) {
      resolve(null);
      return;
    }

    Geolocation.getCurrentPosition(
      (pos: any) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
};

// Best-effort device make/model/OS for the corporate capture flow. Never
// throws — falls back to a parsed User-Agent string on web, and to blank
// fields on native if react-native-device-info isn't linked.
export const getDeviceInfo = async (): Promise<CapturedDevice> => {
  if (Platform.OS === 'web') {
    const ua = (globalThis as any)?.navigator?.userAgent || '';
    return { model: 'Web Browser', os: (globalThis as any)?.navigator?.platform || 'web', osVersion: ua };
  }

  if (!DeviceInfo) {
    return { model: '', os: Platform.OS, osVersion: String(Platform.Version || '') };
  }

  try {
    const [model, os, osVersion] = await Promise.all([
      DeviceInfo.getModel(),
      DeviceInfo.getSystemName(),
      DeviceInfo.getSystemVersion(),
    ]);
    return { model: model || '', os: os || Platform.OS, osVersion: String(osVersion || '') };
  } catch (err) {
    console.error('getDeviceInfo failed:', err);
    return { model: '', os: Platform.OS, osVersion: String(Platform.Version || '') };
  }
};
