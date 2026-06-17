import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import AppLayout from '../components/AppLayout';
import NotificationDetailModal from '../components/NotificationDetailModal';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, ui, shadow } from '../theme';

// On web the flex chain can collapse to 0 height; pin a min height for the list.
const { height: screenH } = Dimensions.get('window');
const LIST_MIN_H = Math.max(320, screenH - 70 - 70 - 120);

interface NotificationsScreenProps {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

// Notification level -> accent color used for the left rail + icon dot.
const LEVEL_COLOR: Record<string, string> = {
  info: colors.accent,
  success: colors.success,
  warning: '#c9820a',
  critical: colors.danger,
};

const TYPE_ICON: Record<string, string> = {
  transfer_request: '⇄',
  transfer_confirmed: '✓',
  transfer_received: '★',
  transfer_rejected: '✕',
  system: '📢',
};

export default function NotificationsScreen({ navigation, user, onLogout }: NotificationsScreenProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const isMountedRef = useRef(true);

  const userId = user?._id ? String(user._id) : '';

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}notification?recipient_kind=User&recipient_id=${encodeURIComponent(userId)}&limit=50`
      );
      const data = await res.json();
      if (isMountedRef.current && res.ok && data?.status === 'success' && Array.isArray(data.data)) {
        setItems(data.data);
      }
    } catch (error) {
      // Keep the last successful list on transient errors.
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [userId]);

  // Initial load + real-time refresh every 3 seconds.
  useEffect(() => {
    isMountedRef.current = true;
    load();
    const id = setInterval(load, 3000);
    return () => {
      isMountedRef.current = false;
      clearInterval(id);
    };
  }, [load]);

  const markRead = async (notifId: string) => {
    if (!userId || !notifId) return;
    try {
      await fetch(`${API_BASE_URL}notification/${encodeURIComponent(notifId)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: userId }),
      });
    } catch (error) {
      /* best-effort */
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(`${API_BASE_URL}notification/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_kind: 'User', recipient_id: userId }),
      });
    } catch (error) {
      /* best-effort */
    }
    load();
  };

  const onPressItem = (item: any) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      markRead(item._id);
    }
    // Every notification opens a detail dialog: transfer requests show the
    // approve/decline flow, system notifications show their content.
    setSelected(item);
  };

  const renderItem = ({ item }: { item: any }) => {
    const color = LEVEL_COLOR[item.level] || colors.accent;
    const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        activeOpacity={0.8}
        onPress={() => onPressItem(item)}
      >
        <View style={[styles.rail, { backgroundColor: color }]} />
        <View style={[styles.iconBadge, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.iconText, { color }]}>{TYPE_ICON[item.type] || '•'}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.read && <View style={[styles.dot, { backgroundColor: color }]} />}
          </View>
          {!!item.message && (
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>
          )}
          {!!when && <Text style={styles.time}>{when}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const hasUnread = items.some((n) => !n.read);

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[ui.screenTitle, styles.headerTitle]}>{t('notifications')}</Text>
          {hasUnread && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
              <Text style={styles.markAllText}>{t('markAllRead')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {loading && items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('noNotifications')}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, idx) => `${item._id || idx}`}
            style={styles.flatList}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
          />
        )}
      </View>
      <NotificationDetailModal
        visible={!!selected}
        notification={selected}
        user={user}
        onClose={() => setSelected(null)}
        onActionDone={load}
      />
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: { marginBottom: 0, flexShrink: 1 },
  markAllBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  markAllText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  flatList: { flex: 1, minHeight: LIST_MIN_H },
  list: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow(1),
  },
  rowUnread: { borderColor: colors.accent, backgroundColor: '#f3f8ff' },
  rail: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
  },
  iconText: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 14, color: colors.heading, fontWeight: '600' },
  titleUnread: { fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.sm },
  message: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4 },
});
