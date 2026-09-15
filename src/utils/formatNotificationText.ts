// Some backend-generated notifications (e.g. "New sign-in detected on
// <user-agent>") embed a raw browser User-Agent string, which reads as
// meaningless technical noise to a consumer. There's no server-side change
// in scope here, so this is a defensive client-side pass: detect a UA-shaped
// substring and swap it for a short human description before it's ever
// rendered. Safe no-op on any text that doesn't contain one.
//
// Matches from "Mozilla/" through to the end of the string rather than
// stopping at the first ")" or "," -- a real UA string is a chain of several
// parenthetical groups (e.g. "...like Mac OS X) AppleWebKit/605.1.15 (KHTML,
// like Gecko) Version/17.0 ..."), each containing its own commas, so a
// narrower pattern leaves a dangling fragment like ", like Gecko) ..." behind.
// These notification messages never have real trailing content after the UA.
const UA_PATTERN = /Mozilla\/[\s\S]*/i;

// Short device noun (no article) -- "Windows", not "a Windows PC" -- for the
// compact canonical sign-in phrasing below. Long form used only as a
// fallback for messages that embed a UA but aren't a sign-in alert.
function describeDeviceShort(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'your device';
}

function describeBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/CriOS/i.test(ua)) return 'Chrome';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return '';
}

const SIGN_IN_PATTERN = /sign[- ]?in/i;

/**
 * Replaces any raw User-Agent substring in `text` with short, readable
 * device/browser wording. For a sign-in alert specifically, this rewrites
 * the *whole* message into one compact canonical phrase ("New sign-in on
 * Chrome on Windows") instead of splicing a description into whatever
 * sentence the backend wrote around the UA -- that backend wording plus even
 * the long device form was still long enough to truncate on a 2-line
 * message. Any other message shape that happens to embed a UA falls back to
 * a plain substring swap.
 */
export function humanizeNotificationText(text?: string | null): string {
  const value = text || '';
  if (!UA_PATTERN.test(value)) return value;
  const match = value.match(UA_PATTERN)![0];
  const device = describeDeviceShort(match);
  const browser = describeBrowser(match);

  if (SIGN_IN_PATTERN.test(value)) {
    return browser ? `New sign-in on ${browser} on ${device}` : `New sign-in from ${device}`;
  }
  return value.replace(UA_PATTERN, browser ? `${browser} on ${device}` : device);
}
