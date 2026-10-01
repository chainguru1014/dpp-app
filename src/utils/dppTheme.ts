import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { colors } from '../theme';

/**
 * A brand's own look for its product pages (the "DPP experience" set in the
 * admin panel's product window > Experience). Kept in sync with
 * backend/utils/dppTheme.ts and frontend/src/utils/dppTheme.js — the server
 * already normalizes what it returns; this normalizes again so a bad or
 * missing response can only ever fall back to the standard Yometel look.
 */

export type DppSectionKey = 'journey' | 'care' | 'materials' | 'dispose' | 'traceability';
export type DppFont = 'system' | 'serif' | 'rounded' | 'mono';

export interface DppTheme {
  pageBg: string;
  cardBg: string;
  accent: string;
  buttonText: string;
  textColor: string;
  buttonRadius: number;
  fontFamily: DppFont;
  sections: { key: DppSectionKey; visible: boolean }[];
}

/** Same keys as `colors` in theme.ts, but any colour — what a themed screen draws with. */
export type Palette = { [K in keyof typeof colors]: string };

const SECTION_KEYS: DppSectionKey[] = ['journey', 'care', 'materials', 'dispose', 'traceability'];
const FONT_KEYS: DppFont[] = ['system', 'serif', 'rounded', 'mono'];

export const DEFAULT_DPP_THEME: DppTheme = {
  pageBg: '#f4f7fc',
  cardBg: '#ffffff',
  accent: '#1b4f72',
  buttonText: '#ffffff',
  textColor: '#33415c',
  buttonRadius: 12,
  fontFamily: 'system',
  sections: SECTION_KEYS.map((key) => ({ key, visible: true })),
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const color = (value: any, fallback: string) => (HEX.test(String(value || '').trim()) ? String(value).trim() : fallback);

export const normalizeDppTheme = (raw: any): DppTheme => {
  const t = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_DPP_THEME;
  const seen = new Set<string>();
  const sections: DppTheme['sections'] = [];
  (Array.isArray(t.sections) ? t.sections : []).forEach((s: any) => {
    if (!s || !SECTION_KEYS.includes(s.key) || seen.has(s.key)) return;
    seen.add(s.key);
    sections.push({ key: s.key, visible: s.visible !== false });
  });
  SECTION_KEYS.forEach((key) => {
    if (!seen.has(key)) sections.push({ key, visible: true });
  });
  const radius = Number(t.buttonRadius);
  return {
    pageBg: color(t.pageBg, d.pageBg),
    cardBg: color(t.cardBg, d.cardBg),
    accent: color(t.accent, d.accent),
    buttonText: color(t.buttonText, d.buttonText),
    textColor: color(t.textColor, d.textColor),
    buttonRadius: Number.isFinite(radius) ? Math.max(0, Math.min(30, Math.round(radius))) : d.buttonRadius,
    fontFamily: FONT_KEYS.includes(t.fontFamily) ? t.fontFamily : d.fontFamily,
    sections,
  };
};

/** Blend two #rrggbb colours; `amount` 0 = all `a`, 1 = all `b`. */
const mix = (a: string, b: string, amount: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * The standard palette with the brand's colours swapped in. The look and
 * layout of every screen stay the same — only the colour tokens change.
 */
export const buildPalette = (theme: DppTheme): Palette => ({
  ...colors,
  navy: theme.accent,
  primary: theme.accent,
  primaryDark: mix(theme.accent, '#000000', 0.25),
  accent: theme.accent,
  header: theme.accent,
  headerLight: mix(theme.accent, '#ffffff', 0.35),
  heading: theme.accent,
  bg: theme.pageBg,
  fieldBg: theme.pageBg,
  surface: theme.cardBg,
  surfaceAlt: mix(theme.cardBg, theme.accent, 0.07),
  border: mix(theme.cardBg, theme.accent, 0.14),
  text: theme.textColor,
  textBody: theme.textColor,
  muted: mix(theme.textColor, theme.cardBg, 0.2),
  onDark: theme.buttonText,
});

/** Platform font for a theme font choice; undefined = leave the system font. */
export const fontFamilyFor = (font: DppFont): string | undefined => {
  if (font === 'serif') return Platform.select({ web: 'Georgia, "Times New Roman", serif', ios: 'Georgia', default: 'serif' });
  if (font === 'rounded') return Platform.select({ web: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif', ios: 'Trebuchet MS', default: 'sans-serif-medium' });
  if (font === 'mono') return Platform.select({ web: '"Courier New", Consolas, monospace', ios: 'Courier New', default: 'monospace' });
  return undefined;
};

/** Adds the brand font to every text style (anything with a fontSize) of a style sheet. */
export const withFont = <T extends Record<string, any>>(styles: T, fontFamily?: string): T => {
  if (!fontFamily) return styles;
  const out: Record<string, any> = {};
  Object.keys(styles).forEach((key) => {
    const s = styles[key];
    out[key] = s && typeof s === 'object' && 'fontSize' in s ? { ...s, fontFamily } : s;
  });
  return out as T;
};

// One request per company per app session — product screens open often.
const themeCache: Record<string, DppTheme> = {};

export interface BrandLook {
  theme: DppTheme;
  palette: Palette;
  fontFamily?: string;
  /** False until a brand has actually changed something — screens then keep their exact standard look. */
  isCustom: boolean;
}

const STANDARD_LOOK: BrandLook = { theme: DEFAULT_DPP_THEME, palette: colors, fontFamily: undefined, isCustom: false };

/**
 * The look to draw a product's pages with. `enabled: false` (staff sessions,
 * which keep the standard look) or no company yet returns the standard look.
 */
export const useBrandLook = (product: any, enabled = true): BrandLook => {
  const rawCompany = product?.company_id;
  const companyId = rawCompany && typeof rawCompany === 'object' ? String(rawCompany._id || '') : String(rawCompany || '');
  const [theme, setTheme] = useState<DppTheme | null>(companyId ? themeCache[companyId] || null : null);

  useEffect(() => {
    if (!enabled || !companyId) {
      setTheme(null);
      return;
    }
    if (themeCache[companyId]) {
      setTheme(themeCache[companyId]);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE_URL}company/${encodeURIComponent(companyId)}/dpp-theme`)
      .then((r) => r.json())
      .then((j) => {
        const loaded = normalizeDppTheme(j?.data?.dppTheme);
        themeCache[companyId] = loaded;
        if (!cancelled) setTheme(loaded);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [companyId, enabled]);

  return useMemo(() => {
    if (!enabled || !theme || JSON.stringify(theme) === JSON.stringify(DEFAULT_DPP_THEME)) return STANDARD_LOOK;
    return { theme, palette: buildPalette(theme), fontFamily: fontFamilyFor(theme.fontFamily), isCustom: true };
  }, [theme, enabled]);
};
