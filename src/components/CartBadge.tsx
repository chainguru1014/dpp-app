import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { listCart, onCartChanged } from '../utils/consumerApi';
import { colors } from '../theme';

/**
 * Item count on the header cart icon. Like NotificationBadge it keeps its own
 * state so updates re-render only this leaf. It refreshes on mount (every
 * screen), whenever the cart changes in the app, and when the window regains
 * focus.
 */
export default function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const items = await listCart();
        if (active) setCount(items.length);
      } catch (e) {
        /* transient — keep last value */
      }
    };
    refresh();
    const off = onCartChanged(refresh);
    const w: any = typeof window !== 'undefined' ? window : null;
    w?.addEventListener?.('focus', refresh);
    return () => {
      active = false;
      off();
      w?.removeEventListener?.('focus', refresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
});
