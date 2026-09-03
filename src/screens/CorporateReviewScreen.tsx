import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Modal, TouchableWithoutFeedback, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import AppLayout from '../components/AppLayout';
import GradientView from '../components/GradientView';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_SIZE = 5;

type PeriodOption = 'today' | 'week' | 'month';
type FilterTab = 'newest' | 'all' | 'flagged';

interface CaptureDoc {
  _id: string;
  refNumber: string;
  rawValue: string;
  imagePath: string;
  capturedAt: string;
  terminalId: string;
  workerLabel: string;
  identifierType: string;
  flagged: boolean;
  location?: { latitude: number | null; longitude: number | null; accuracy: number | null; address?: string };
  device?: { model: string; os: string; osVersion: string };
}

interface ProcessStep {
  entity: string;
  type: string;
}

interface CorporateReviewScreenProps {
  navigation: any;
  route: any;
  user: any;
  onLogout?: () => void;
}

// Same key EmployeeHomeScreen persists the tapped Worker Operations tile
// under — read here so landing on Review via the bottom tab (no explicit
// stepIndex param) defaults to whatever step the worker last selected on
// Home, instead of "All steps".
const SELECTED_STEP_STORAGE_KEY = 'employeeSelectedStepIndex';

export default function CorporateReviewScreen({ navigation, route, user, onLogout }: CorporateReviewScreenProps) {
  const { t } = useI18n();
  const routeStepIndex: number | undefined = route?.params?.stepIndex;

  const [stepIndex, setStepIndex] = useState<number | undefined>(routeStepIndex);
  const [step, setStep] = useState<ProcessStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<CaptureDoc[]>([]);
  const [period, setPeriod] = useState<PeriodOption>('today');
  const [filter, setFilter] = useState<FilterTab>('newest');
  const [detailDoc, setDetailDoc] = useState<CaptureDoc | null>(null);
  const [detailPos, setDetailPos] = useState({ top: 0, left: 0 });
  const [periodMenuVisible, setPeriodMenuVisible] = useState(false);
  const [periodPopover, setPeriodPopover] = useState({ top: 0, right: 0 });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const tokenRef = useRef<string>('');
  const periodButtonRef = useRef<View>(null);

  useEffect(() => {
    if (routeStepIndex !== undefined) return;
    AsyncStorage.getItem(SELECTED_STEP_STORAGE_KEY).then((stored) => {
      if (stored != null) setStepIndex(Number(stored));
    });
  }, [routeStepIndex]);

  // Only needed to render the Entity/Type subtitle (matching Scan
  // Operation's subtitle style) — the capture list itself is fetched by
  // `load()` below using stepIndex directly, not this.
  useEffect(() => {
    if (stepIndex === undefined) {
      setStep(null);
      return;
    }
    (async () => {
      const token = await AsyncStorage.getItem('userToken');
      try {
        const res = await fetch(`${API_BASE_URL}company/process-steps`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json().catch(() => ({}));
        const steps: ProcessStep[] = data?.data?.processSteps || [];
        setStep(steps[stepIndex] || null);
      } catch (err) {
        console.error('Failed to load process step:', err);
      }
    })();
  }, [stepIndex]);

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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, period, docs]);

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

  const visibleDocs = filteredDocs.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDocs.length;

  const DETAIL_POPUP_WIDTH = 240;

  // Shows the tapped row's detail as a floating popup anchored just below
  // the tap point (mouse click on web, touch on native) — not an inline
  // panel that pushes the rest of the list down.
  const openDetail = (doc: CaptureDoc, e: any) => {
    const { pageY, pageX } = e.nativeEvent;
    setDetailPos({
      top: pageY + 8,
      left: Math.min(Math.max(12, pageX - DETAIL_POPUP_WIDTH / 2), SCREEN_WIDTH - DETAIL_POPUP_WIDTH - 12),
    });
    setDetailDoc(doc);
  };

  const openPeriodMenu = () => {
    periodButtonRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      setPeriodPopover({
        top: y + height + 6,
        right: Math.max(12, SCREEN_WIDTH - x - width),
      });
      setPeriodMenuVisible(true);
    });
  };

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

  const subtitle = stepIndex !== undefined
    ? (step ? `${step.entity} / ${step.type}` : undefined)
    : t('corpAllSteps');

  const periodOptions: { key: PeriodOption; label: string }[] = [
    { key: 'today', label: t('corpToday') },
    { key: 'week', label: t('corpThisWeek') },
    { key: 'month', label: t('corpThisMonth') },
  ];
  const filterOptions: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'newest', label: t('corpFilterNewest'), icon: 'schedule' },
    { key: 'all', label: t('corpFilterAll'), icon: 'grid-view' },
    { key: 'flagged', label: t('corpFilterFlagged'), icon: 'star-border' },
  ];

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      title={t('reviewHistoryTitle')}
      subtitle={subtitle}
      flatContent
    >
      <View style={styles.container}>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <VectorIcon name="event" size={13} color={colors.primary} />
            <Text style={styles.statLabel}>{t('corpDateLabel')}</Text>
            <Text style={styles.statValue}>{new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.statCell}>
            <FeatherIcon name="file-text" size={13} color={colors.primary} />
            <Text style={styles.statLabel}>{t('corpRecordsLabel')}</Text>
            <Text style={styles.statValue}>{filteredDocs.length}</Text>
          </View>
          <View style={styles.statCell}>
            <VectorIcon name="filter-list" size={13} color={colors.primary} />
            <Text style={styles.statLabel}>{t('corpPeriodLabel')}</Text>
            <TouchableOpacity onPress={openPeriodMenu} activeOpacity={0.7}>
              <View ref={periodButtonRef} style={styles.periodButton}>
                <Text style={styles.periodButtonText}>{periodOptions.find((o) => o.key === period)?.label}</Text>
                <VectorIcon name="arrow-drop-down" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={periodMenuVisible} transparent animationType="none" onRequestClose={() => setPeriodMenuVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setPeriodMenuVisible(false)}>
            <View style={styles.periodOverlay}>
              <View style={[styles.periodPopover, { position: 'absolute', top: periodPopover.top, right: periodPopover.right }]}>
                {periodOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.periodPopoverItem, period === opt.key && styles.periodPopoverItemActive]}
                    onPress={() => {
                      setPeriod(opt.key);
                      setPeriodMenuVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.periodPopoverText, period === opt.key && styles.periodPopoverTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <View style={styles.tabRow}>
          {filterOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.tab, filter === opt.key && styles.tabActive]}
              onPress={() => setFilter(opt.key)}
            >
              {filter === opt.key && (
                <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
              )}
              <VectorIcon
                name={opt.icon}
                size={13}
                color={filter === opt.key ? '#fff' : colors.muted}
                style={styles.tabIcon}
              />
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
            {visibleDocs.map((doc, index) => (
              <View key={doc._id} style={styles.row}>
                <TouchableOpacity
                  style={styles.rowHeader}
                  onPress={(e) => openDetail(doc, e)}
                  activeOpacity={0.7}
                >
                  {doc.imagePath ? (
                    <Image source={{ uri: `${API_BASE_URL.replace(/\/$/, '')}${doc.imagePath}` }} style={styles.rowImage} />
                  ) : (doc.identifierType === 'rfid' || doc.identifierType === 'nfc') && (
                    <View style={styles.rowTagIconBox}>
                      <VectorIcon name={doc.identifierType === 'rfid' ? 'wifi-tethering' : 'nfc'} size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowRef} numberOfLines={1}>{doc.refNumber}</Text>
                    <Text style={styles.rowTime}>{new Date(doc.capturedAt).toLocaleTimeString()}</Text>
                  </View>
                  <View style={[styles.badge, index === 0 ? styles.badgeLatest : styles.badgeSaved]}>
                    <Text style={index === 0 ? styles.badgeLatestText : styles.badgeTextOnColor}>
                      {index === 0 ? t('corpLatestBadge') : t('corpSavedBadge')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFlag(doc._id)} style={styles.flagButton}>
                    <VectorIcon
                      name={doc.flagged ? 'star' : 'star-border'}
                      size={18}
                      color={doc.flagged ? colors.warning : colors.muted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            ))}
            {hasMore && (
              <TouchableOpacity style={styles.moreButton} onPress={() => setVisibleCount((c) => c + PAGE_SIZE)} activeOpacity={0.7}>
                <VectorIcon name="expand-more" size={16} color={colors.primary} />
                <Text style={styles.moreButtonText}>{t('corpMoreRecordsBelow')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      <Modal visible={!!detailDoc} transparent animationType="none" onRequestClose={() => setDetailDoc(null)}>
        <TouchableWithoutFeedback onPress={() => setDetailDoc(null)}>
          <View style={styles.detailOverlay}>
            {!!detailDoc && (
              <View style={[styles.detailPopover, { position: 'absolute', top: detailPos.top, left: detailPos.left }]}>
                <DetailRow icon="smartphone" label={t('corpTerminalIdLabel')} value={detailDoc.terminalId || '—'} />
                <DetailRow icon="person" label={t('corpWorkerLabel')} value={detailDoc.workerLabel || '—'} />
                <DetailRow
                  icon="place"
                  label={t('corpLocationLabel')}
                  value={detailDoc.location?.address || '—'}
                />
                <DetailRow
                  icon="gps-fixed"
                  label={t('corpGpsLabel')}
                  value={detailDoc.location?.latitude != null ? `${detailDoc.location.latitude.toFixed(4)}, ${detailDoc.location.longitude?.toFixed(4)}` : '—'}
                />
                <DetailRow icon="photo-camera" label={t('corpCapturedViaLabel')} value={detailDoc.identifierType || '—'} />
                {!detailDoc.imagePath && !!detailDoc.rawValue && (
                  <DetailRow icon="sell" label={t('corpTagValueLabel')} value={detailDoc.rawValue} />
                )}
                <DetailRow icon="tablet-mac" label={t('corpCapturedDeviceLabel')} value={detailDoc.device?.model || '—'} />
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </AppLayout>
  );
}

const DetailRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelWrap}>
      <VectorIcon name={icon} size={14} color={colors.muted} style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 11, color: colors.muted },
  statValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingLeft: 10,
    paddingRight: 4,
  },
  periodButtonText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  periodOverlay: { flex: 1 },
  periodPopover: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    minWidth: 140,
    ...shadow(3),
  },
  periodPopoverItem: { paddingVertical: 10, paddingHorizontal: spacing.md },
  periodPopoverItemActive: { backgroundColor: colors.surfaceAlt },
  periodPopoverText: { fontSize: 13, color: colors.text },
  periodPopoverTextActive: { color: colors.primary, fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.xs },
  // Selected tab: gray background + dark-blue border (not a solid fill).
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: { marginRight: 4 },
  // GradientView paints the active fill — this just clears the neutral
  // border/background so it doesn't show through underneath.
  tabActive: { backgroundColor: 'transparent', borderColor: 'transparent' },
  tabText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
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
  rowTagIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowInfo: { flex: 1 },
  rowRef: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowTime: { fontSize: 12, color: colors.muted },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginRight: spacing.sm, borderWidth: 1, borderColor: 'transparent' },
  // Latest: outlined (not filled) so it reads distinct from the filled-green Saved badge.
  badgeLatest: { backgroundColor: colors.surface, borderColor: colors.primary },
  badgeLatestText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  badgeSaved: { backgroundColor: colors.success },
  badgeText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  badgeTextOnColor: { fontSize: 11, color: '#fff', fontWeight: '600' },
  flagButton: { padding: 4 },
  // Floating popup (not inline) — anchored near the tap point, same
  // overlay/dismiss pattern as periodOverlay/periodPopover above.
  detailOverlay: { flex: 1 },
  detailPopover: {
    width: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow(3),
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: 6 },
  detailLabel: { fontSize: 12, color: colors.muted },
  detailValue: { fontSize: 12, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  moreButtonText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
