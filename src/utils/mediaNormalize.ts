// Product `images`/`videos` fields aren't always a flat array of strings —
// some API responses come back as a keyed object (e.g. {0: '...', 1: '...'})
// or with nested arrays. MediaSlider needs a flat string array; a shallow
// `Array.isArray` check silently produces [] for anything else, which reads
// as "no media" and hides the slider entirely instead of erroring loudly.
export function normalizeToStringArray(value: any): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item: any) => normalizeToStringArray(item));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap((item: any) => normalizeToStringArray(item));
  }
  return [];
}

export function normalizeToArray(value: any): any[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [value];
}
