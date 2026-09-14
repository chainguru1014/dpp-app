// Some backend-generated notifications (e.g. "New sign-in detected on
// <user-agent>") embed a raw browser User-Agent string, which reads as
// meaningless technical noise to a consumer. There's no server-side change
// in scope here, so this is a defensive client-side pass: detect a UA-shaped
// substring and swap it for a short human description before it's ever
// rendered. Safe no-op on any text that doesn't contain one.
const UA_PATTERN = /Mozilla\/[\d.]+\s*\([^)]*\)[^,;\n]*/i;

function describeDevice(ua: string): string {
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  let device = 'a device';
  if (isIPhone) device = 'an iPhone';
  else if (isIPad) device = 'an iPad';
  else if (isAndroid) device = 'an Android device';
  else if (isMac) device = 'a Mac';
  else if (isWindows) device = 'a Windows PC';
  else if (isLinux) device = 'a Linux device';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  return browser ? `${browser} on ${device}` : device;
}

/** Replaces any raw User-Agent substring in `text` with a short, readable device description. */
export function humanizeNotificationText(text?: string | null): string {
  const value = text || '';
  if (!UA_PATTERN.test(value)) return value;
  return value.replace(UA_PATTERN, (match) => describeDevice(match));
}
