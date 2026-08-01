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
  // Reverse-geocoded "City, Country" (best-effort, blank on any failure —
  // see resolveAddress). Shown as the Review page's "Location" field, with
  // the raw latitude/longitude shown separately under "GPS".
  address: string;
}

export interface CapturedDevice {
  model: string;
  os: string;
  osVersion: string;
}

// Best-effort reverse geocode via OpenStreetMap's Nominatim (free, no API
// key). Never throws — blank on any failure, timeout, or missing network,
// same degrade-gracefully contract as the rest of this file.
const resolveAddress = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => null);
    const addr = data?.address;
    if (!addr) return '';
    const place = addr.city || addr.town || addr.village || addr.county || addr.state || '';
    const country = addr.country_code ? String(addr.country_code).toUpperCase() : (addr.country || '');
    if (place && country) return `${place}, ${country}`;
    return place || country || '';
  } catch (err) {
    return '';
  }
};

const buildLocation = async (latitude: number, longitude: number, accuracy: number | null): Promise<CapturedLocation> => ({
  latitude,
  longitude,
  accuracy,
  address: await resolveAddress(latitude, longitude),
});

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
        async (pos: any) => resolve(await buildLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null)),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
      return;
    }

    if (!Geolocation) {
      resolve(null);
      return;
    }

    const requestFix = () => {
      Geolocation.getCurrentPosition(
        async (pos: any) => resolve(await buildLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null)),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    };

    // iOS needs an explicit authorization request before getCurrentPosition
    // will prompt/succeed (Android's permission is requested separately via
    // PermissionsAndroid before the capture screen ever mounts its camera —
    // see CorporateScannerScreen's permission effect). This call itself
    // triggers the system prompt on first use; a no-op if already granted.
    if (Platform.OS === 'ios' && typeof Geolocation.requestAuthorization === 'function') {
      try {
        const result = Geolocation.requestAuthorization('whenInUse');
        if (result && typeof result.finally === 'function') {
          result.finally(requestFix);
        } else {
          requestFix();
        }
      } catch (err) {
        requestFix();
      }
    } else {
      requestFix();
    }
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
