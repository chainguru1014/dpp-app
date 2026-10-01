import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { colors } from '../theme';

/**
 * A brand's own design for its product pages (the "DPP experience" set in
 * the admin panel's product window > Experience): colours, style, layout and
 * a little brand content. The same shape and the same clean-up live in
 * backend/utils/dppTheme.ts and frontend/src/utils/dppTheme.js — change all
 * three together. The server already normalizes what it returns; this
 * normalizes again so a bad or missing response can only ever fall back to
 * the standard Yometel look.
 */

export type DppSectionKey = 'journey' | 'care' | 'materials' | 'dispose' | 'traceability' | 'compliance';
export type DppBlockKey = 'highlights' | 'lifecycle' | 'about' | 'brand' | 'message' | 'cta' | 'feedback' | 'actions';
export type DppFont = 'system' | 'serif' | 'rounded' | 'mono';

export interface DppTheme {
  pageBg: string;
  cardBg: string;
  accent: string;
  buttonText: string;
  textColor: string;
  /** '' = follow `accent`. */
  headerColor: string;
  badgeColor: string;
  headerStyle: 'gradient' | 'solid';
  buttonStyle: 'gradient' | 'solid' | 'outline';
  buttonRadius: number;
  cardStyle: 'shadow' | 'border' | 'flat';
  cardRadius: number;
  tabStyle: 'underline' | 'pills';
  textScale: 'small' | 'normal' | 'large';
  fontFamily: DppFont;
  heroLayout: 'side' | 'top';
  showProductId: boolean;
  /** Product Overview blocks, in the brand's order. */
  blocks: { key: DppBlockKey; visible: boolean }[];
  /** Product Lifecycle tabs, in the brand's order. */
  sections: { key: DppSectionKey; visible: boolean }[];
  message: { title: string; body: string };
  cta: { label: string; url: string };
}

/**
 * What a themed screen draws with: the same keys as `colors` in theme.ts
 * (any colour), plus the text colours that sit on the brand's own colours.
 */
export type Palette = { [K in keyof typeof colors]: string } & {
  /** Text on a filled (accent) button. */
  onPrimary: string;
  /** Text and icons on the header / top bar. */
  onHeader: string;
  /** The "Authenticated" badge and its tick. */
  badge: string;
  onBadge: string;
};

export const BASE_PALETTE: Palette = { ...colors, onPrimary: '#ffffff', onHeader: '#ffffff', badge: colors.primary, onBadge: '#ffffff' };

const SECTIONS: { key: DppSectionKey; on: boolean }[] = [
  { key: 'journey', on: true },
  { key: 'care', on: true },
  { key: 'materials', on: true },
  { key: 'dispose', on: true },
  { key: 'traceability', on: true },
  { key: 'compliance', on: true },
];
/** `on` = shown in the standard look. */
const BLOCKS: { key: DppBlockKey; on: boolean }[] = [
  { key: 'highlights', on: true },
  { key: 'lifecycle', on: true },
  { key: 'about', on: false },
  { key: 'brand', on: false },
  { key: 'message', on: false },
  { key: 'cta', on: false },
  { key: 'feedback', on: true },
  { key: 'actions', on: true },
];
const CHOICES = {
  headerStyle: ['gradient', 'solid'],
  buttonStyle: ['gradient', 'solid', 'outline'],
  cardStyle: ['shadow', 'border', 'flat'],
  tabStyle: ['underline', 'pills'],
  textScale: ['small', 'normal', 'large'],
  heroLayout: ['side', 'top'],
  fontFamily: ['system', 'serif', 'rounded', 'mono'],
} as const;
const TEXT_SCALE = { small: 0.92, normal: 1, large: 1.12 } as const;

export const DEFAULT_DPP_THEME: DppTheme = {
  pageBg: '#f4f7fc',
  cardBg: '#ffffff',
  accent: '#1b4f72',
  buttonText: '#ffffff',
  textColor: '#33415c',
  headerColor: '',
  badgeColor: '',
  headerStyle: 'gradient',
  buttonStyle: 'gradient',
  buttonRadius: 12,
  cardStyle: 'shadow',
  cardRadius: 16,
  tabStyle: 'underline',
  textScale: 'normal',
  fontFamily: 'system',
  heroLayout: 'side',
  showProductId: true,
  blocks: BLOCKS.map((b) => ({ key: b.key, visible: b.on })),
  sections: SECTIONS.map((s) => ({ key: s.key, visible: true })),
  message: { title: '', body: '' },
  cta: { label: '', url: '' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const color = (value: any, fallback: string) => (HEX.test(String(value || '').trim()) ? String(value).trim() : fallback);
const choice = <K extends keyof typeof CHOICES>(value: any, name: K, fallback: (typeof CHOICES)[K][number]) =>
  ((CHOICES[name] as readonly string[]).includes(value) ? value : fallback) as (typeof CHOICES)[K][number];
const clampInt = (value: any, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};
const text = (value: any, max: number) => String(value ?? '').slice(0, max);

/** An ordered show/hide list: every known key once, in the brand's order. */
const orderedList = <K extends string>(raw: any, known: { key: K; on: boolean }[]) => {
  const seen = new Set<string>();
  const out: { key: K; visible: boolean }[] = [];
  (Array.isArray(raw) ? raw : []).forEach((item: any) => {
    const def = item && known.find((k) => k.key === item.key);
    if (!def || seen.has(def.key)) return;
    seen.add(def.key);
    out.push({ key: def.key, visible: item.visible !== false });
  });
  known.forEach((def) => {
    if (!seen.has(def.key)) out.push({ key: def.key, visible: def.on });
  });
  return out;
};

export const normalizeDppTheme = (raw: any): DppTheme => {
  const t = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_DPP_THEME;
  return {
    pageBg: color(t.pageBg, d.pageBg),
    cardBg: color(t.cardBg, d.cardBg),
    accent: color(t.accent, d.accent),
    buttonText: color(t.buttonText, d.buttonText),
    textColor: color(t.textColor, d.textColor),
    headerColor: color(t.headerColor, ''),
    badgeColor: color(t.badgeColor, ''),
    headerStyle: choice(t.headerStyle, 'headerStyle', d.headerStyle),
    buttonStyle: choice(t.buttonStyle, 'buttonStyle', d.buttonStyle),
    buttonRadius: clampInt(t.buttonRadius, 0, 30, d.buttonRadius),
    cardStyle: choice(t.cardStyle, 'cardStyle', d.cardStyle),
    cardRadius: clampInt(t.cardRadius, 0, 28, d.cardRadius),
    tabStyle: choice(t.tabStyle, 'tabStyle', d.tabStyle),
    textScale: choice(t.textScale, 'textScale', d.textScale),
    fontFamily: choice(t.fontFamily, 'fontFamily', d.fontFamily),
    heroLayout: choice(t.heroLayout, 'heroLayout', d.heroLayout),
    showProductId: t.showProductId !== false,
    blocks: orderedList(t.blocks, BLOCKS),
    sections: orderedList(t.sections, SECTIONS),
    message: { title: text(t.message?.title, 80), body: text(t.message?.body, 400) },
    cta: { label: text(t.cta?.label, 40), url: text(t.cta?.url, 300).trim() },
  };
};

/** Blend two #rrggbb colours; `amount` 0 = all `a`, 1 = all `b`. */
const mix = (a: string, b: string, amount: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`;
};

/** White or near-black, whichever reads better on the given colour. */
const readableOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1a1a1a' : '#ffffff';
};

/**
 * The standard palette with the brand's colours swapped in. The layout of
 * every screen stays the same — only the colour tokens change.
 */
export const buildPalette = (theme: DppTheme): Palette => {
  const header = theme.headerColor || theme.accent;
  const badge = theme.badgeColor || theme.accent;
  const onHeader = readableOn(header);
  return {
    ...colors,
    navy: theme.accent,
    primary: theme.accent,
    primaryDark: mix(theme.accent, '#000000', 0.25),
    accent: theme.accent,
    header,
    // The light end of the header gradient; the same as `header` when plain.
    headerLight: theme.headerStyle === 'solid' ? header : mix(header, '#ffffff', 0.35),
    heading: theme.accent,
    bg: theme.pageBg,
    fieldBg: theme.pageBg,
    surface: theme.cardBg,
    surfaceAlt: mix(theme.cardBg, theme.accent, 0.07),
    border: mix(theme.cardBg, theme.accent, 0.14),
    text: theme.textColor,
    textBody: theme.textColor,
    muted: mix(theme.textColor, theme.cardBg, 0.2),
    placeholder: mix(theme.textColor, theme.cardBg, 0.45),
    onDark: onHeader,
    onDarkSoft: onHeader,
    onDarkDim: mix(onHeader, header, 0.25),
    onPrimary: theme.buttonText,
    onHeader,
    badge,
    onBadge: readableOn(badge),
  };
};

/** Platform font for a theme font choice; undefined = leave the system font. */
export const fontFamilyFor = (font: DppFont): string | undefined => {
  if (font === 'serif') return Platform.select({ web: 'Georgia, "Times New Roman", serif', ios: 'Georgia', default: 'serif' });
  if (font === 'rounded') return Platform.select({ web: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif', ios: 'Trebuchet MS', default: 'sans-serif-medium' });
  if (font === 'mono') return Platform.select({ web: '"Courier New", Consolas, monospace', ios: 'Courier New', default: 'monospace' });
  return undefined;
};

export interface BrandLook {
  theme: DppTheme;
  palette: Palette;
  fontFamily?: string;
  /** False until a brand has actually changed something — screens then keep their exact standard look. */
  isCustom: boolean;
}

/**
 * Applies the non-colour parts of a look to a screen's style sheet:
 * the brand font and text size on every text style, and the card corners /
 * card style on the styles the screen names as its cards.
 */
export const applyLook = <T extends Record<string, any>>(styles: T, look: BrandLook, cardKeys: string[] = []): T => {
  const scale = TEXT_SCALE[look.theme.textScale];
  const { cardStyle, cardRadius } = look.theme;
  const out: Record<string, any> = {};
  Object.keys(styles).forEach((key) => {
    let s = styles[key];
    if (s && typeof s === 'object') {
      if ('fontSize' in s) {
        s = {
          ...s,
          fontSize: Math.round(s.fontSize * scale * 10) / 10,
          ...(typeof s.lineHeight === 'number' ? { lineHeight: Math.round(s.lineHeight * scale) } : {}),
          ...(look.fontFamily ? { fontFamily: look.fontFamily } : {}),
        };
      }
      if (cardKeys.includes(key)) {
        s = {
          ...s,
          borderRadius: cardRadius,
          ...(cardStyle === 'shadow' ? {} : { shadowOpacity: 0, elevation: 0 }),
          ...(cardStyle === 'flat' ? { borderWidth: 0 } : {}),
        };
      }
    }
    out[key] = s;
  });
  return out as T;
};

/** Gradient ends and text colour for a filled button, per the brand's button style. */
export const buttonFill = (look: BrandLook) => {
  const p = look.palette;
  if (!look.isCustom) return { from: p.headerLight, to: p.primary, text: '#ffffff', border: null as null | { borderWidth: number; borderColor: string } };
  if (look.theme.buttonStyle === 'outline') {
    return { from: p.surface, to: p.surface, text: p.primary, border: { borderWidth: 1.5, borderColor: p.primary } };
  }
  if (look.theme.buttonStyle === 'solid') return { from: p.primary, to: p.primary, text: p.onPrimary, border: null };
  return { from: mix(p.primary, '#ffffff', 0.35), to: p.primary, text: p.onPrimary, border: null };
};

// One request per brand per app session — product screens open often.
const themeCache: Record<string, DppTheme> = {};

const STANDARD_LOOK: BrandLook = { theme: DEFAULT_DPP_THEME, palette: BASE_PALETTE, fontFamily: undefined, isCustom: false };

/**
 * The look to draw a product's pages with. `enabled: false` (staff sessions,
 * which keep the standard look) or no company yet returns the standard look.
 */
export const useBrandLook = (product: any, enabled = true): BrandLook => {
  const rawCompany = product?.company_id;
  const companyId = rawCompany && typeof rawCompany === 'object' ? String(rawCompany._id || '') : String(rawCompany || '');
  // A company can sell under several brands, each with its own design.
  const brandName = String(product?.brandInfo?.name || '').trim();
  const cacheKey = companyId ? `${companyId}|${brandName.toLowerCase()}` : '';
  const [theme, setTheme] = useState<DppTheme | null>(cacheKey ? themeCache[cacheKey] || null : null);

  useEffect(() => {
    if (!enabled || !cacheKey) {
      setTheme(null);
      return;
    }
    if (themeCache[cacheKey]) {
      setTheme(themeCache[cacheKey]);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE_URL}company/${encodeURIComponent(companyId)}/dpp-theme?brand=${encodeURIComponent(brandName)}`)
      .then((r) => r.json())
      .then((j) => {
        const loaded = normalizeDppTheme(j?.data?.dppTheme);
        themeCache[cacheKey] = loaded;
        if (!cancelled) setTheme(loaded);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  return useMemo(() => {
    if (!enabled || !theme || JSON.stringify(theme) === JSON.stringify(DEFAULT_DPP_THEME)) return STANDARD_LOOK;
    return { theme, palette: buildPalette(theme), fontFamily: fontFamilyFor(theme.fontFamily), isCustom: true };
  }, [theme, enabled]);
};
