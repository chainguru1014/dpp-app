import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

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

interface Props {
  visible: boolean;
  user: any;
  onClose: () => void;
  onOpenDetail: (notification: any) => void;
  onShowAll: () => void;
}

export default function NotificationPanel({ visible, user, onClose, onOpenDetail, onShowAll }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const userId = user?._id ? String(user._id) : '';

  const markRead = async (id: string) => {
    if (!userId || !id) return;
    try {
      await fetch(`${API_BASE_URL}notification/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: userId }),
      });
    } catch (e) {
      /* best-effort */
    }
  };

  const handlePress = (n: any) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      markRead(n._id);
    }
    onOpenDetail(n);
  };

  useEffect(() => {
    if (!visible || !userId) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}notification?recipient_kind=User&recipient_id=${encodeURIComponent(userId)}&limit=8`
        );
        const data = await res.json();
        if (active && res.ok && data?.status === 'success' && Array.isArray(data.data)) {
          setItems(data.data);
        }
      } catch (e) {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, userId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.panel}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('notifications')}</Text>
              </View>
              {loading && items.length === 0 ? (
                <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.xl }} />
              ) : items.length === 0 ? (
                <Text style={styles.empty}>{t('noNotifications')}</Text>
              ) : (
                <ScrollView style={styles.list}>
                  {items.map((n, idx) => {
                    const color = LEVEL_COLOR[n.level] || colors.accent;
                    return (
                      <TouchableOpacity
                        key={n._id || idx}
                        style={[styles.row, !n.read && styles.rowUnread]}
                        activeOpacity={0.8}
                        onPress={() => handlePress(n)}
                      >
                        <View style={[styles.iconBadge, { backgroundColor: `${color}22` }]}>
                          <Text style={[styles.iconText, { color }]}>{TYPE_ICON[n.type] || '•'}</Text>
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={[styles.rowTitle, !n.read && styles.rowTitleUnread]} numberOfLines={1}>
                            {n.title}
                          </Text>
                          {!!n.message && (
                            <Text style={styles.rowMsg} numberOfLines={1}>
                              {n.message}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.showAll} onPress={onShowAll} activeOpacity={0.7}>
                <Text style={styles.showAllText}>{t('showAll')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  panel: {
    position: 'absolute',
    top: 64,
    right: 10,
    width: 320,
    maxWidth: '92%',
    maxHeight: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow(3),
    overflow: 'hidden',
  },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 15, fontWeight: '800', color: colors.heading },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: spacing.xxl, fontSize: 14 },
  list: { maxHeight: 330 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowUnread: { backgroundColor: '#f3f8ff' },
  iconBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  iconText: { fontSize: 15, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13, color: colors.heading, fontWeight: '600' },
  rowTitleUnread: { fontWeight: '800' },
  rowMsg: { fontSize: 12, color: colors.muted, marginTop: 1 },
  showAll: { paddingVertical: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceAlt },
  showAllText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
