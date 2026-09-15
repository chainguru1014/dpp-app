import React from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';
import { useBottomBarSpace } from './AppLayout';
import { spacing } from '../theme';

/**
 * The standard ScrollView for a screen's main scrollable content --
 * guarantees the last card/button can always scroll fully above the fixed
 * bottom tab bar, using the bar's real measured height (design height +
 * this device's actual safe-area inset via useBottomBarSpace/
 * useSafeAreaInsets), never a guessed device-specific number.
 *
 * One shared place for this instead of every screen repeating its own
 * `spacing.lg + bottomBarSpace` inline -- see AppLayout.useBottomBarSpace.
 */
export default function BottomSafeScrollView({ contentContainerStyle, ...rest }: ScrollViewProps) {
  const bottomBarSpace = useBottomBarSpace();
  return (
    <ScrollView
      contentContainerStyle={[{ paddingBottom: spacing.lg + bottomBarSpace }, contentContainerStyle]}
      {...rest}
    />
  );
}
