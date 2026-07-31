import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

type PeriodOption = 'today' | 'week' | 'month';
type FilterTab = 'newest' | 'all' | 'flagged';

interface CaptureDoc {
  _id: string;
  refNumber: string;
  imagePath: string;
  capturedAt: string;
  terminalId: string;
  workerLabel: string;
  identifierType: string;
  flagged: boolean;
  location?: { latitude: number | null; longitude: number | null; accuracy: number | null };
  device?: { model: string; os: string; osVersion: string };
}

interface CorporateReviewScreenProps {
  navigation: any;
  route: any;
  user: any;
  onLogout?: () => void;
}

export default function CorporateReviewScreen({ navigation, route, user, onLogout }: CorporateReviewScreenProps) {
  const { t } = useI18n();
  const stepIndex: number | undefined = route?.params?.stepIndex;

  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<CaptureDoc[]>([]);
  const [period, setPeriod] = useState<PeriodOption>('today');
  const [filter, setFilter] = useState<FilterTab>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tokenRef = useRef<string>('');

  const load = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('userToken');
    tokenRef.current = token || '';
    try {
      const params = new URLSearchParams();
      if (stepIndex !== undefined) params.set('stepIndex', String(stepIndex));
      params.set('date', period === 'today' ? 'today' : 'all');
      const res = await fetch(`${API_BASE_URL}captures?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      setDocs(data?.data?.docs || []);
    } catch (err) {
      console.error('Failed to load captures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, period]);

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (period === 'week' || period === 'month') {
      const cutoff = Date.now() - (period === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000;
      list = list.filter((d) => new Date(d.capturedAt).getTime() >= cutoff);
    }
    if (filter === 'flagged') list = list.filter((d) => d.flagged);
    // API already sorts capturedAt desc; 'newest' and 'all' share that order,
    // 'newest' just implies the default (no additional client-side re-sort needed).
    return list;
  }, [docs, filter, period]);

  const toggleFlag = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}captures/${id}/flag`, {
        method: 'PATCH',
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined,
      });
      await load();
    } catch (err) {
      console.error('Failed to toggle flag:', err);
    }
  };

  const subtitle = stepIndex !== undefined ? `${stepIndex + 1}` : t('corpAllSteps');

  const periodOptions: { key: PeriodOption; label: string }[] = [
    { key: 'today', label: t('corpToday') },
    { key: 'week', label: t('corpThisWeek') },
    { key: 'month', label: t('corpThisMonth') },
  ];
  const filterOptions: { key: FilterTab; label: string }[] = [
    { key: 'newest', label: t('corpFilterNewest') },
    { key: 'all', label: t('corpFilterAll') },
    { key: 'flagged', label: t('corpFilterFlagged') },
  ];

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      title={t('reviewHistoryTitle')}
      subtitle={subtitle}
    >
      <View style={styles.container}>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>{t('corpDateLabel')}</Text>
            <Text style={styles.statValue}>{new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>{t('corpRecordsLabel')}</Text>
            <Text style={styles.statValue}>{filteredDocs.length}</Text>
          </View>
          <View style={styles.periodPicker}>
            {periodOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.periodChip, period === opt.key && styles.periodChipActive]}
                onPress={() => setPeriod(opt.key)}
              >
                <Text style={[styles.periodChipText, period === opt.key && styles.periodChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.tabRow}>
          {filterOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.tab, filter === opt.key && styles.tabActive]}
              onPress={() => setFilter(opt.key)}
            >
              <Text style={[styles.tabText, filter === opt.key && styles.tabTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : filteredDocs.length === 0 ? (
          <Text style={styles.emptyText}>{t('corpNoCaptures')}</Text>
        ) : (
          <ScrollView>
            {filteredDocs.map((doc, index) => {
              const expanded = expandedId === doc._id;
              return (
                <View key={doc._id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowHeader}
                    onPress={() => setExpandedId(expanded ? null : doc._id)}
                    activeOpacity={0.7}
                  >
                    {!!doc.imagePath && (
                      <Image source={{ uri: `${API_BASE_URL.replace(/\/$/, '')}${doc.imagePath}` }} style={styles.rowImage} />
                    )}
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowRef} numberOfLines={1}>{doc.refNumber}</Text>
                      <Text style={styles.rowTime}>{new Date(doc.capturedAt).toLocaleTimeString()}</Text>
                    </View>
                    <View style={[styles.badge, index === 0 && styles.badgeLatest]}>
                      <Text style={[styles.badgeText, index === 0 && styles.badgeTextLatest]}>
                        {index === 0 ? t('corpLatestBadge') : t('corpSavedBadge')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleFlag(doc._id)} style={styles.flagButton}>
                      <Text style={{ color: doc.flagged ? colors.warning : colors.muted }}>★</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.detailPanel}>
                      <DetailRow label={t('corpTerminalIdLabel')} value={doc.terminalId || '—'} />
                      <DetailRow label={t('corpWorkerLabel')} value={doc.workerLabel || '—'} />
                      <DetailRow
                        label={t('corpLocationLabel')}
                        value={doc.location?.latitude != null ? `${doc.location.latitude.toFixed(4)}, ${doc.location.longitude?.toFixed(4)}` : '—'}
                      />
                      <DetailRow
                        label={t('corpGpsLabel')}
                        value={doc.location?.accuracy != null ? `±${Math.round(doc.location.accuracy)}m` : '—'}
                      />
                      <DetailRow label={t('corpCapturedViaLabel')} value={doc.identifierType || '—'} />
                      <DetailRow
                        label={t('corpCapturedDeviceLabel')}
                        value={doc.device?.model ? `${doc.device.model} (${doc.device.os} ${doc.device.osVersion})` : '—'}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  statCell: { marginRight: spacing.lg },
  statLabel: { fontSize: 11, color: colors.muted },
  statValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  periodPicker: { flexDirection: 'row', marginLeft: 'auto', gap: 4 },
  periodChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  periodChipActive: { backgroundColor: colors.primary },
  periodChipText: { fontSize: 11, color: colors.muted },
  periodChipTextActive: { color: '#fff', fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  rowImage: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, marginRight: spacing.md },
  rowInfo: { flex: 1 },
  rowRef: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowTime: { fontSize: 12, color: colors.muted },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginRight: spacing.sm },
  badgeLatest: { backgroundColor: colors.primary },
  badgeText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  badgeTextLatest: { color: '#fff' },
  flagButton: { padding: 4 },
  detailPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: colors.muted },
  detailValue: { fontSize: 12, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
});
