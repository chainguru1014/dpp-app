import { StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

// Big icon-first sign-in buttons shared by the Login/Signup screen's Face and
// Email tiles and GoogleAuthButton/AppleAuthButton's `variant="tile"`, so all
// four methods read as one set.
export const AUTH_TILE_ICON = 46;
export const AUTH_TILE_ICON_MAIN = 76;

export const authTileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadow(2),
  },
  // The main method (Face): taller, filled brand blue.
  tileMain: {
    minHeight: 168,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  labelMain: {
    color: colors.white,
    fontSize: 20,
  },
});
