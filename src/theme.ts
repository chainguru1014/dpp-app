import { Platform, StyleSheet } from 'react-native';

/**
 * App UI theme rule — single source of truth for the visual language.
 *
 * The look established by HomeScreen / ShopNowScreen:
 *  - A navy → blue palette on a soft light-blue canvas.
 *  - White cards with generous rounded corners, a hairline border and a soft navy shadow.
 *  - Navy / blue gradients for hero + header surfaces (web).
 *  - Headings in PRIMARY, body in a desaturated slate, hints in a muted blue-grey.
 *
 * Screens should compose these tokens / helpers instead of hard-coding colours
 * so the whole app stays consistent.
 */

export const colors = {
  // Main brand blue — dark navy, used across all UI (icons, headings, fills).
  // Matches the frontend admin project's official palette (src/theme.js:
  // navy #1b4f72 / navyDark #123a56) — the app had drifted to a brighter,
  // more saturated blue during a UI pass, which read as a different "brand"
  // next to the frontend. headerLight was already correct (same azure both
  // projects use as the gradient's light stop / accent).
  navy: '#1b4f72',
  primary: '#1b4f72',
  primaryDark: '#123a56',
  accent: '#1b4f72',

  // Top bar / header surface (dark navy, gradients to headerLight)
  header: '#1b4f72',
  headerLight: '#4a96dd',

  // Surfaces
  bg: '#f4f7fc',
  surface: '#ffffff',
  surfaceAlt: '#eef2f8',
  fieldBg: '#f4f7fc',
  border: '#e7edf6',
  borderStrong: '#d3dbe8',

  // Text
  heading: '#1b4f72',
  text: '#33415c',
  textBody: '#33415c',
  // Darkened from the original #7a8aa3 -- that shade sits under 4.5:1 contrast
  // on white/surfaceAlt, and this color is used for helper text, timestamps,
  // and other information users actually need to read (not just decoration).
  muted: '#5c6b84',
  placeholder: '#9aa7bd',

  // On dark (hero / header) surfaces
  onDark: '#ffffff',
  onDarkSoft: 'rgba(255,255,255,0.92)',
  onDarkDim: 'rgba(255,255,255,0.82)',
  onDarkAccent: '#bcd3ff',

  // Status
  white: '#ffffff',
  danger: '#d32f2f',
  dangerSoft: '#fdecec',
  success: '#2e7d32',
  successSoft: '#e7f4e8',
  warning: '#b26a00',

  overlay: 'rgba(15, 23, 42, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Minimum comfortable touch-target side length (logical px) for any tappable control. */
export const MIN_TOUCH = 48;

/** Primary/secondary CTA button heights. */
export const buttonHeight = {
  primary: 54,
  secondary: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 15,
  sm: 16,
  md: 19,
  lg: 22,
  xl: 25,
  xxl: 30,
  xxxl: 38,
} as const;

/** Soft, navy-tinted elevation. Level 1 (subtle) → 3 (hero / floating). */
export const shadow = (level: 1 | 2 | 3 = 1) => {
  const map = {
    1: { shadowColor: colors.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    2: { shadowColor: colors.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 5 },
    3: { shadowColor: colors.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 6 },
  } as const;
  return map[level];
};

const isWeb = Platform.OS === 'web';

/** Web-only CSS gradients (no-op on native, where a solid colour is used instead). */
export const gradients = {
  hero: isWeb ? ({ backgroundImage: `linear-gradient(135deg, ${colors.headerLight} 0%, ${colors.header} 100%)` } as any) : null,
  header: isWeb ? ({ backgroundImage: `linear-gradient(135deg, ${colors.headerLight} 0%, ${colors.header} 100%)` } as any) : null,
  accent: isWeb ? ({ backgroundImage: `linear-gradient(135deg, ${colors.headerLight} 0%, ${colors.primary} 100%)` } as any) : null,
};

/**
 * Reusable building blocks. Compose them with screen-specific overrides, e.g.
 *   <View style={[ui.card, { marginTop: spacing.xl }]}>
 */
export const ui = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow(2),
  },
  // Hero / banner surface (use with gradients.hero on web)
  hero: {
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 28,
    backgroundColor: colors.primary,
    ...shadow(3),
  },
  // Section / dark header strip (use with gradients.header on web)
  headerStrip: {
    backgroundColor: colors.navy,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  // Page title: ~22-26px.
  screenTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.heading,
  },
  // Card / section title: ~19-21px.
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '400',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: colors.textBody,
    lineHeight: 20,
  },
  mutedText: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  input: {
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: buttonHeight.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  buttonGhost: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    height: buttonHeight.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhostText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  // Selectable pill (gender / user-type toggles, language, etc.)
  chip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.muted,
    fontSize: fontSize.md,
    fontWeight: '400',
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '400',
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
  // Bottom-sheet style modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  // Centered dialog modal
  dialogOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow(3),
  },
});

export default { colors, spacing, radius, fontSize, shadow, gradients, ui, MIN_TOUCH, buttonHeight };
