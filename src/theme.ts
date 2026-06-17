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
  navy: '#1f3361',
  primary: '#3d5c93',
  primaryDark: '#2f3f5a',
  accent: '#1976d2',

  // Surfaces
  bg: '#f4f7fc',
  surface: '#ffffff',
  surfaceAlt: '#eef2f8',
  fieldBg: '#f4f7fc',
  border: '#e7edf6',
  borderStrong: '#d3dbe8',

  // Text
  heading: '#1f3361',
  text: '#33415c',
  textBody: '#33415c',
  muted: '#7a8aa3',
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

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
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
  hero: isWeb ? ({ backgroundImage: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.navy} 100%)` } as any) : null,
  header: isWeb ? ({ backgroundImage: `linear-gradient(120deg, ${colors.navy} 0%, ${colors.primary} 100%)` } as any) : null,
  accent: isWeb ? ({ backgroundImage: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.primary} 100%)` } as any) : null,
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
  screenTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '400',
    color: colors.heading,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '400',
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
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '400',
  },
  buttonGhost: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhostText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '400',
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

export default { colors, spacing, radius, fontSize, shadow, gradients, ui };
