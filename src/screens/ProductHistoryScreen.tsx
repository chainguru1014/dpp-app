import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface Props {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

type TabKey = 'all' | 'scanned' | 'visited';

interface Event {
  _id: string;
  source: 'scan' | 'visit';
  scanned_at: string;
  location?: { country?: string; region?: string; city?: string } | null;
}

const locationLine = (loc?: Event['location']) => {
  if (!loc) return '';
  return [loc.city, loc.region, loc.country].filter((x) => typeof x === 'string' && x.trim()).join(', ');
};

export default function ProductHistoryScreen({ navigation, route, user, onLogout }: Props) {
  const { t } = useI18n();
  const productId = route?.params?.productId;
  const name = route?.params?.name || route?.params?.product?.name || t('homeProduct');
  const [tab, setTab] = useState<TabKey>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id || !productId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}qrcode/scan/history/mine?user_id=${encodeURIComponent(String(user._id))}&product_id=${encodeURIComponent(String(productId))}`
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.status === 'success' && Array.isArray(data.data)) setEvents(data.data);
      } catch (e) {
        console.error('Product history load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id, productId]);

  const grouped = useMemo(() => {
    const filtered = tab === 'all' ? events : events.filter((e) => e.source === (tab === 'scanned' ? 'scan' : 'visit'));
    const groups: { label: string; items: Event[] }[] = [];
    filtered.forEach((e) => {
      const d = new Date(e.scanned_at);
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      let g = groups.find((x) => x.label === label);
      if (!g) {
        g = { label, items: [] };
        groups.push(g);
      }
      g.items.push(e);
    });
    return groups;
  }, [events, tab]);

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.goBack()}
      title={name}
    >
      <View style={styles.screen}>
        <View style={styles.tabRow}>
          {([
            { key: 'all' as const, label: t('productHistoryTabAll') },
            { key: 'scanned' as const, label: t('productHistoryTabScanned') },
            { key: 'visited' as const, label: t('productHistoryTabVisited') },
          ]).map((tb) => (
            <TouchableOpacity
              key={tb.key}
              style={[styles.tab, tab === tb.key && styles.tabActive]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{tb.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xxxl }} />
        ) : grouped.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('noHistoryYet')}</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {grouped.map((group) => (
              <View key={group.label}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.items.map((e) => {
                  const isScan = e.source === 'scan';
                  const d = new Date(e.scanned_at);
                  const loc = locationLine(e.location);
                  return (
                    <View key={e._id} style={styles.row}>
                      <View style={[styles.iconBubble, { backgroundColor: isScan ? colors.surfaceAlt : '#e6f4ea' }]}>
                        <Icon
                          name={isScan ? 'qr-code-scanner' : 'place'}
                          size={16}
                          color={isScan ? colors.primary : colors.success}
                        />
                      </View>
                      <View style={styles.info}>
                        <Text style={styles.eventTitle}>
                          {isScan ? t('productHistoryScanned') : t('productHistoryVisited')}
                        </Text>
                        <Text style={styles.eventMeta}>
                          {d.toLocaleDateString()} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {!!loc && <Text style={styles.eventLoc}>{loc}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: 15, color: colors.muted },
  list: { paddingBottom: spacing.xxxl },
  groupLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  iconBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: colors.heading },
  eventMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  eventLoc: { fontSize: 12, color: colors.placeholder, marginTop: 1 },
});
