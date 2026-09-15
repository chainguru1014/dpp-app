import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout, { useBottomBarSpace } from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow, MIN_TOUCH } from '../theme';

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
  const bottomBarSpace = useBottomBarSpace();
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

  // Consecutive events of the same kind (e.g. three "Viewed product" in a
  // row) collapse into one summary row -- purely a display grouping, every
  // underlying event is still in `events` and shown individually on expand.
  const [openRunKey, setOpenRunKey] = useState<string | null>(null);
  type Run = { key: string; source: Event['source']; items: Event[] };

  const grouped = useMemo(() => {
    const filtered = tab === 'all' ? events : events.filter((e) => e.source === (tab === 'scanned' ? 'scan' : 'visit'));
    const groups: { label: string; runs: Run[] }[] = [];
    filtered.forEach((e, idx) => {
      const d = new Date(e.scanned_at);
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      let g = groups.find((x) => x.label === label);
      if (!g) {
        g = { label, runs: [] };
        groups.push(g);
      }
      const lastRun = g.runs[g.runs.length - 1];
      if (lastRun && lastRun.source === e.source) {
        lastRun.items.push(e);
      } else {
        g.runs.push({ key: `${label}-${idx}`, source: e.source, items: [e] });
      }
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
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === tb.key }}
              accessibilityLabel={tb.label}
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
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: spacing.lg + bottomBarSpace }]}>
            {grouped.map((group) => (
              <View key={group.label}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.runs.map((run, runIdx) => {
                  const isScan = run.source === 'scan';
                  const title = isScan ? t('productHistoryScanned') : t('productHistoryVisited');
                  const lastRun = runIdx === group.runs.length - 1;
                  const isCollapsedRun = run.items.length > 1;
                  const isOpen = openRunKey === run.key;

                  if (!isCollapsedRun) {
                    const e = run.items[0];
                    const d = new Date(e.scanned_at);
                    const loc = locationLine(e.location);
                    return (
                      <View
                        key={e._id}
                        style={styles.row}
                        accessible
                        accessibilityLabel={[title, d.toLocaleDateString(), loc].filter(Boolean).join(', ')}
                      >
                        <View style={styles.railCol}>
                          {!lastRun && <View style={styles.rail} />}
                          <View style={[styles.iconBubble, { backgroundColor: isScan ? '#e7f0fb' : '#e6f4ea' }]}>
                            <Icon name={isScan ? 'qr-code-scanner' : 'visibility'} size={26} color={isScan ? colors.primary : colors.success} />
                          </View>
                        </View>
                        <View style={styles.info}>
                          <Text style={styles.eventTitle}>{title}</Text>
                          <Text style={styles.eventMeta}>
                            {d.toLocaleDateString()} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {!!loc && <Text style={styles.eventLoc}>{loc}</Text>}
                        </View>
                      </View>
                    );
                  }

                  // Collapsed run: several of the same kind back to back --
                  // one summary row, expandable to the individual timestamps.
                  // Nothing is deleted from `events`; this only changes how
                  // it's displayed.
                  const newest = new Date(run.items[0].scanned_at);
                  const summaryLabel = `${title} ${t('timesSuffix').replace('{count}', String(run.items.length))}`;
                  return (
                    <View key={run.key}>
                      <TouchableOpacity
                        style={styles.row}
                        activeOpacity={0.7}
                        onPress={() => setOpenRunKey(isOpen ? null : run.key)}
                        accessibilityRole="button"
                        accessibilityLabel={summaryLabel}
                        accessibilityState={{ expanded: isOpen }}
                      >
                        <View style={styles.railCol}>
                          {!lastRun && <View style={styles.rail} />}
                          <View style={[styles.iconBubble, { backgroundColor: isScan ? '#e7f0fb' : '#e6f4ea' }]}>
                            <Icon name={isScan ? 'qr-code-scanner' : 'visibility'} size={26} color={isScan ? colors.primary : colors.success} />
                          </View>
                        </View>
                        <View style={styles.info}>
                          <Text style={styles.eventTitle}>{summaryLabel}</Text>
                          <Text style={styles.eventMeta}>{newest.toLocaleDateString()}</Text>
                        </View>
                        <Icon name={isOpen ? 'expand-less' : 'expand-more'} size={22} color={colors.muted} />
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={styles.runDetail}>
                          {run.items.map((e) => {
                            const d = new Date(e.scanned_at);
                            const loc = locationLine(e.location);
                            return (
                              <View key={e._id} style={styles.runDetailRow}>
                                <Text style={styles.runDetailTime}>
                                  {d.toLocaleDateString()} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                {!!loc && <Text style={styles.runDetailLoc}>{loc}</Text>}
                              </View>
                            );
                          })}
                        </View>
                      )}
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
  tab: { flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center', paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 19, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: 22, color: colors.muted },
  list: { paddingBottom: spacing.xxxl },
  groupLabel: { fontSize: 18, fontWeight: '700', color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  railCol: { alignItems: 'center', justifyContent: 'center', width: 52, position: 'relative' },
  rail: { position: 'absolute', top: 0, bottom: -8, width: 2, backgroundColor: colors.border },
  iconBubble: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  info: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  eventTitle: { fontSize: 20, fontWeight: '600', color: colors.heading },
  eventMeta: { fontSize: 18, color: colors.muted, marginTop: 3 },
  eventLoc: { fontSize: 18, color: colors.muted, marginTop: 2 },
  runDetail: {
    marginLeft: 52 + spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  runDetailRow: { paddingVertical: 4 },
  runDetailTime: { fontSize: 17, color: colors.text },
  runDetailLoc: { fontSize: 16, color: colors.muted, marginTop: 1 },
});
