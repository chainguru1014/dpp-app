import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import BottomSafeScrollView from '../components/BottomSafeScrollView';
import NotificationDetailModal from '../components/NotificationDetailModal';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { humanizeNotificationText } from '../utils/formatNotificationText';
import { colors, spacing, radius, shadow, MIN_TOUCH } from '../theme';

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

// Generic, data-safe description of what a grouped run represents -- kept
// deliberately vague per type rather than inventing specifics (e.g. no device
// info) since only the notification's `type` is known at grouping time.
const TYPE_GROUP_DESCRIPTOR: Record<string, string> = {
  login_alert: 'sign-ins',
  lifecycle_updated: 'lifecycle changes',
  transfer_request: 'ownership requests',
  transfer_confirmed: 'ownership updates',
  transfer_rejected: 'ownership updates',
  transfer_received: 'ownership updates',
  product_authenticated: 'authentication checks',
  system: 'updates',
};

// "Security Alert" -> "Security Alerts" -- naive pluralization is safe here
// since these are short, admin-authored notification titles.
const pluralizeGroupTitle = (title: string) => (/s$/i.test(title) ? title : `${title}s`);

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

  // Consecutive notifications of the same type+title (e.g. several
  // "Product authenticated" rows back to back) collapse into one summary
  // row -- same run-grouping convention used on the product history screen.
  // Every underlying notification is still in `items` and still individually
  // tappable once expanded; nothing here changes read/unread tracking.
  type Run = { key: string; groupKey: string; items: any[] };
  const runs: Run[] = [];
  items.forEach((item, idx) => {
    const groupKey = `${item.type || ''}|${humanizeNotificationText(item.title)}`;
    const last = runs[runs.length - 1];
    if (last && last.groupKey === groupKey) {
      last.items.push(item);
    } else {
      runs.push({ key: `${groupKey}-${idx}`, groupKey, items: [item] });
    }
  });
  const [openRunKey, setOpenRunKey] = useState<string | null>(null);

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.navigate(user?.actorKind === 'Employee' ? 'EmployeeHome' : 'Home')} flatContent={user?.actorKind === 'Employee'} flushBottom>
      <View style={styles.screen}>
        {hasUnread && (
          <TouchableOpacity
            style={styles.markAll}
            onPress={markAllRead}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('markAllRead')}
          >
            <Text style={styles.markAllText}>{t('markAllRead')}</Text>
          </TouchableOpacity>
        )}
        {loading && items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('loading')}</Text></View>
        ) : items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('noNotifications')}</Text></View>
        ) : (
          <BottomSafeScrollView contentContainerStyle={styles.list}>
            {runs.map((run) => {
              const isCollapsedRun = run.items.length >= 3;
              if (!isCollapsedRun) {
                return run.items.map((item, idx) => {
                  const color = LEVEL_COLOR[item.level] || colors.accent;
                  const title = humanizeNotificationText(item.title);
                  const message = humanizeNotificationText(item.message);
                  return (
                    <TouchableOpacity
                      key={item._id || `${run.key}-${idx}`}
                      style={[styles.row, !item.read && styles.rowUnread]}
                      activeOpacity={0.8}
                      onPress={() => onPressItem(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${!item.read ? 'Unread. ' : ''}${title}. ${message}. ${relativeTime(item.createdAt)}`}
                    >
                      <View style={[styles.iconBubble, { backgroundColor: `${color}22` }]}>
                        <Icon name={TYPE_ICON[item.type] || 'notifications'} size={28} color={color} />
                      </View>
                      <View style={styles.info}>
                        <View style={styles.titleRow}>
                          {!item.read && <View style={styles.unreadDot} />}
                          <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>{title}</Text>
                        </View>
                        {!!message && <Text style={styles.message} numberOfLines={2}>{message}</Text>}
                      </View>
                      <View style={styles.metaCol}>
                        <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                        <Icon name="chevron-right" size={20} color={colors.muted} />
                      </View>
                    </TouchableOpacity>
                  );
                });
              }

              // Collapsed run: 3+ of the same type+title back to back. The
              // group title is pluralized ("Security Alert" -> "Security
              // Alerts") and paired with a plain-language count subtitle
              // ("7 recent sign-ins") instead of a bare "(7)" suffix, so the
              // row explains what was grouped rather than just how many.
              const head = run.items[0];
              const color = LEVEL_COLOR[head.level] || colors.accent;
              const title = humanizeNotificationText(head.title);
              const pluralTitle = pluralizeGroupTitle(title);
              const descriptor = TYPE_GROUP_DESCRIPTOR[head.type] || 'updates';
              const anyUnread = run.items.some((n) => !n.read);
              const isOpen = openRunKey === run.key;
              const summarySubtitle = `${run.items.length} recent ${descriptor}`;
              const summaryA11yLabel = `${pluralTitle}, ${run.items.length} notifications${anyUnread ? ', unread' : ''}`;
              return (
                <View key={run.key}>
                  <TouchableOpacity
                    style={[styles.row, anyUnread && styles.rowUnread]}
                    activeOpacity={0.8}
                    onPress={() => setOpenRunKey(isOpen ? null : run.key)}
                    accessibilityRole="button"
                    accessibilityLabel={summaryA11yLabel}
                    accessibilityState={{ expanded: isOpen }}
                  >
                    <View style={[styles.iconBubble, { backgroundColor: `${color}22` }]}>
                      <Icon name={TYPE_ICON[head.type] || 'notifications'} size={28} color={color} />
                    </View>
                    <View style={styles.info}>
                      <View style={styles.titleRow}>
                        {anyUnread && <View style={styles.unreadDot} />}
                        <Text style={[styles.title, anyUnread && styles.titleUnread]} numberOfLines={1}>{pluralTitle}</Text>
                      </View>
                      <Text style={styles.message} numberOfLines={1}>{summarySubtitle}</Text>
                    </View>
                    <Icon name={isOpen ? 'expand-less' : 'expand-more'} size={22} color={colors.muted} />
                  </TouchableOpacity>
                  {isOpen && run.items.map((item, idx) => {
                    const iColor = LEVEL_COLOR[item.level] || colors.accent;
                    const iTitle = humanizeNotificationText(item.title);
                    const message = humanizeNotificationText(item.message);
                    return (
                      <TouchableOpacity
                        key={item._id || `${run.key}-item-${idx}`}
                        style={[styles.row, styles.runDetailRow, !item.read && styles.rowUnread]}
                        activeOpacity={0.8}
                        onPress={() => onPressItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${!item.read ? 'Unread. ' : ''}${iTitle}. ${message}. ${relativeTime(item.createdAt)}`}
                      >
                        <View style={[styles.iconBubble, { backgroundColor: `${iColor}22` }]}>
                          <Icon name={TYPE_ICON[item.type] || 'notifications'} size={28} color={iColor} />
                        </View>
                        <View style={styles.info}>
                          <View style={styles.titleRow}>
                            {!item.read && <View style={styles.unreadDot} />}
                            <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>{iTitle}</Text>
                          </View>
                          {!!message && <Text style={styles.message} numberOfLines={2}>{message}</Text>}
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                          <Icon name="chevron-right" size={20} color={colors.muted} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </BottomSafeScrollView>
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
  markAll: { alignSelf: 'flex-end', minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 4, marginBottom: spacing.sm },
  markAllText: { fontSize: 17, color: colors.accent, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: 20, color: colors.muted },
  // paddingBottom comes from BottomSafeScrollView (real bottom-bar clearance).
  list: {},
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
  // Was a strong accent-coloured border -- made every card look "selected"
  // or urgent regardless of what it actually was. Unread state now reads
  // from the dot + bold title + this subtle tint alone, not a heavy border.
  rowUnread: { backgroundColor: '#f4f8ff' },
  runDetailRow: { marginLeft: spacing.lg },
  iconBubble: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  title: { flexShrink: 1, fontSize: 22, color: colors.heading },
  titleUnread: { fontWeight: '700' },
  message: { fontSize: 19, color: colors.muted, marginTop: 3, lineHeight: 26 },
  metaCol: { alignItems: 'flex-end', gap: 5 },
  time: { fontSize: 17, color: colors.muted },
});
