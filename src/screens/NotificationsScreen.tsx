import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import NotificationDetailModal from '../components/NotificationDetailModal';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface Props {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

const LEVEL_COLOR: Record<string, string> = {
  info: colors.accent,
  success: colors.success,
  warning: '#c9820a',
  critical: colors.danger,
};

const TYPE_ICON: Record<string, string> = {
  transfer_request: 'swap-horiz',
  transfer_confirmed: 'local-shipping',
  transfer_rejected: 'cancel',
  transfer_received: 'redeem',
  product_authenticated: 'shield',
  lifecycle_updated: 'sync',
  login_alert: 'lock',
  system: 'star',
};

const relativeTime = (iso: string) => {
  const d = new Date(iso).getTime();
  if (!d) return '';
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export default function NotificationsScreen({ navigation, user, onLogout }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const mounted = useRef(true);
  const userId = user?._id ? String(user._id) : '';

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}notification?recipient_kind=User&recipient_id=${encodeURIComponent(userId)}&limit=50`);
      const data = await res.json();
      if (mounted.current && res.ok && data?.status === 'success' && Array.isArray(data.data)) setItems(data.data);
    } catch (e) {
      /* keep last */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    load();
    const id = setInterval(load, 5000);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load]);

  const markAllRead = async () => {
    if (!userId) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(`${API_BASE_URL}notification/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_kind: 'User', recipient_id: userId }),
      });
    } catch (e) {
      /* best effort */
    }
    load();
  };

  const onPressItem = (item: any) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      fetch(`${API_BASE_URL}notification/${encodeURIComponent(item._id)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: userId }),
      }).catch(() => {});
    }
    setSelected(item);
  };

  const hasUnread = items.some((n) => !n.read);

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.navigate('Scanner')} flatContent>
      <View style={styles.screen}>
        {hasUnread && (
          <TouchableOpacity style={styles.markAll} onPress={markAllRead} activeOpacity={0.7}>
            <Text style={styles.markAllText}>{t('markAllRead')}</Text>
          </TouchableOpacity>
        )}
        {loading && items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('loading')}</Text></View>
        ) : items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('noNotifications')}</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {items.map((item, idx) => {
              const color = LEVEL_COLOR[item.level] || colors.accent;
              return (
                <TouchableOpacity
                  key={item._id || idx}
                  style={[styles.row, !item.read && styles.rowUnread]}
                  activeOpacity={0.8}
                  onPress={() => onPressItem(item)}
                >
                  <View style={[styles.iconBubble, { backgroundColor: `${color}22` }]}>
                    <Icon name={TYPE_ICON[item.type] || 'notifications'} size={24} color={color} />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>{item.title}</Text>
                    {!!item.message && <Text style={styles.message} numberOfLines={2}>{item.message}</Text>}
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  markAll: { alignSelf: 'flex-end', marginBottom: spacing.sm },
  markAllText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: 15, color: colors.muted },
  list: { paddingBottom: spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  rowUnread: { borderColor: colors.accent, backgroundColor: '#f4f8ff' },
  iconBubble: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontSize: 14, color: colors.heading },
  titleUnread: { fontWeight: '700' },
  message: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  metaCol: { alignItems: 'flex-end', gap: 4 },
  time: { fontSize: 11, color: colors.placeholder },
});
