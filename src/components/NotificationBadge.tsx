import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { API_BASE_URL } from '../config/api';

/**
 * Self-contained unread-count badge. It polls every 3 seconds on its own so the
 * tick only re-renders THIS tiny leaf — not the surrounding AppLayout, whose
 * re-render would otherwise churn its Modals and dismiss any open dialog.
 */
export default function NotificationBadge({ userId }: { userId?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let active = true;
    const fetchCount = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}notification/unread-count?recipient_kind=User&recipient_id=${encodeURIComponent(userId)}`
        );
        const data = await res.json();
        if (active && res.ok && data?.status === 'success') {
          const next = Number(data.count) || 0;
          setCount((prev) => (prev === next ? prev : next));
        }
      } catch (e) {
        /* transient — keep last value */
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [userId]);

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
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
});
