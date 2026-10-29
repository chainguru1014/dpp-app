import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Modal, TouchableWithoutFeedback, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientView from '../components/GradientView';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_SIZE = 10;

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
  const [filter, setFilter] = useState<FilterTab>('newest');
  const [detailDoc, setDetailDoc] = useState<CaptureDoc | null>(null);
  // Tap point + measured overlay/popup sizes — the popup's final position is
  // clamped from these at render time so it always fits fully on screen.
  const [detailTap, setDetailTap] = useState({ x: 0, y: 0 });
  const [detailArea, setDetailArea] = useState({ width: 0, height: 0 });
  const [detailSize, setDetailSize] = useState({ width: 0, height: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Guards against a second page request while one is in flight, and drops
  // answers that arrive after the list was reset (filter / step change).
  const loadingMoreRef = useRef(false);
  const listVersionRef = useRef(0);
  const [showCopyInfoDialog, setShowCopyInfoDialog] = useState(false);
  const tokenRef = useRef<string>('');

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

  const fetchPage = async (skip: number) => {
    const token = await AsyncStorage.getItem('userToken');
    tokenRef.current = token || '';
    const params = new URLSearchParams();
    if (stepIndex !== undefined) params.set('stepIndex', String(stepIndex));
    params.set('date', 'all');
    if (filter === 'flagged') params.set('flagged', 'true');
    params.set('skip', String(skip));
    params.set('limit', String(PAGE_SIZE));
    params.set('tzOffset', String(new Date().getTimezoneOffset()));
    const res = await fetch(`${API_BASE_URL}captures?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { docs: (data?.data?.docs || []) as CaptureDoc[], hasMore: !!data?.data?.hasMore };
  };

  // First page (also used to refresh after a flag toggle).
  const load = async () => {
    const version = ++listVersionRef.current;
    setLoading(true);
    try {
      const page = await fetchPage(0);
      if (version !== listVersionRef.current) return;
      setDocs(page.docs);
      setHasMore(page.hasMore);
    } catch (err) {
      console.error('Failed to load captures:', err);
    } finally {
      if (version === listVersionRef.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    const version = listVersionRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(docs.length);
      if (version !== listVersionRef.current) return;
      setDocs((prev) => {
        const seen = new Set(prev.map((d) => d._id));
        return [...prev, ...page.docs.filter((d) => !seen.has(d._id))];
      });
      setHasMore(page.hasMore);
    } catch (err) {
      console.error('Failed to load more captures:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, filter]);

  // Load the next page once the list is scrolled near its end.
  const onListScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 120) loadMore();
  };
  // A first page shorter than the screen can't be scrolled, so keep loading.
  const listHeightRef = useRef(0);
  const onListContentSize = (_w: number, h: number) => {
    if (listHeightRef.current && h <= listHeightRef.current) loadMore();
  };

  const DETAIL_POPUP_MAX_WIDTH = 360;
  const DETAIL_EDGE = 12;

  // Shows the tapped row's detail as a floating popup anchored just below
  // the tap point (mouse click on web, touch on native) — not an inline
  // panel that pushes the rest of the list down.
  const openDetail = (doc: CaptureDoc, e: any) => {
    const { pageY, pageX } = e.nativeEvent;
    setDetailTap({ x: pageX, y: pageY });
    setDetailSize({ width: 0, height: 0 });
    setDetailDoc(doc);
  };

  // Clamp inside the modal's real area (not a module-load Dimensions value,
  // which goes stale when a browser window resizes): as wide as fits, centred
  // on the tap horizontally, below the tap — or above it when it would run
  // off the bottom.
  const detailWidth = Math.min(DETAIL_POPUP_MAX_WIDTH, Math.max(0, (detailArea.width || SCREEN_WIDTH) - DETAIL_EDGE * 2));
  const detailLeft = Math.min(
    Math.max(DETAIL_EDGE, detailTap.x - detailWidth / 2),
    Math.max(DETAIL_EDGE, (detailArea.width || SCREEN_WIDTH) - detailWidth - DETAIL_EDGE),
  );
  const detailTop = (() => {
    const areaH = detailArea.height;
    const popH = detailSize.height;
    const below = detailTap.y + 8;
    if (!areaH || !popH || below + popH <= areaH - DETAIL_EDGE) return below;
    const above = detailTap.y - popH - 8;
    return Math.min(Math.max(DETAIL_EDGE, above), Math.max(DETAIL_EDGE, areaH - popH - DETAIL_EDGE));
  })();

  const toggleFlag = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}captures/${id}/flag`, {
        method: 'PATCH',
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined,
      });
      setDocs((prev) => {
        const next = prev.map((d) => (d._id === id ? { ...d, flagged: !d.flagged } : d));
        return filter === 'flagged' ? next.filter((d) => d.flagged) : next;
      });
    } catch (err) {
      console.error('Failed to toggle flag:', err);
    }
  };

  // IDs/tag values show their real characters (first 6 … last 4 when long
  // enough that truncating actually shortens it) with a copy icon that puts
  // the full value on the clipboard regardless of whether it's truncated.
  const truncateValue = (value: string) => {
    if (!value) return '';
    return value.length > 14 ? `${value.slice(0, 6)} ... ${value.slice(-4)}` : value;
  };

  // Same web/native split ResultScreen's copyToClipboard already uses.
  const copyToClipboard = async (text: string) => {
    try {
      const nav = (globalThis as any)?.navigator;
      if (Platform.OS === 'web' && nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
      } else {
        await Clipboard.setString(text);
      }
      setShowCopyInfoDialog(true);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const subtitle = stepIndex !== undefined
    ? (step ? `${step.entity} / ${step.type}` : undefined)
    : t('corpAllSteps');

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
                size={20}
                color={filter === opt.key ? '#fff' : colors.muted}
                style={styles.tabIcon}
              />
              <Text style={[styles.tabText, filter === opt.key && styles.tabTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : docs.length === 0 ? (
          <Text style={styles.emptyText}>{t('corpNoCaptures')}</Text>
        ) : (
          <ScrollView
            onScroll={onListScroll}
            scrollEventThrottle={100}
            onLayout={(e) => { listHeightRef.current = e.nativeEvent.layout.height; }}
            onContentSizeChange={onListContentSize}
          >
            {docs.map((doc, index) => (
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
                    <View style={styles.rowRefMaskedWrap}>
                      <Text style={styles.rowRef} numberOfLines={1}>{truncateValue(doc.refNumber)}</Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(doc.refNumber)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={t('corpCopyIdLabel')}
                      >
                        <VectorIcon name="content-copy" size={16} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.rowTime}>{new Date(doc.capturedAt).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.badge, index === 0 ? styles.badgeLatest : styles.badgeSaved]}>
                    <Text style={index === 0 ? styles.badgeLatestText : styles.badgeTextOnColor}>
                      {index === 0 ? t('corpLatestBadge') : t('corpSavedBadge')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFlag(doc._id)} style={styles.flagButton}>
                    <VectorIcon
                      name={doc.flagged ? 'star' : 'star-border'}
                      size={27}
                      color={doc.flagged ? colors.warning : colors.muted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            ))}
            {loadingMore && (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loadingMore} />
            )}
          </ScrollView>
        )}
      </View>

      <Modal visible={!!detailDoc} transparent animationType="none" onRequestClose={() => setDetailDoc(null)}>
        <TouchableWithoutFeedback onPress={() => setDetailDoc(null)}>
          <View
            style={styles.detailOverlay}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setDetailArea((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
            }}
          >
            {!!detailDoc && (
              <View
                style={[
                  styles.detailPopover,
                  // Hidden until measured, so it never flashes in the unclamped spot.
                  { position: 'absolute', top: detailTop, left: detailLeft, width: detailWidth, opacity: detailSize.height ? 1 : 0 },
                ]}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setDetailSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
                }}
              >
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
                  <DetailRow icon="sell" label={t('corpTagValueLabel')} value={detailDoc.rawValue} wrap onCopy={() => copyToClipboard(detailDoc.rawValue)} />
                )}
                <DetailRow icon="tablet-mac" label={t('corpCapturedDeviceLabel')} value={detailDoc.device?.model || '—'} />
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={showCopyInfoDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCopyInfoDialog(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCopyInfoDialog(false)}>
          <View style={styles.copyInfoModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.copyInfoModalCard}>
                <Text style={styles.copyInfoModalText}>{t('corpCopiedToClipboard')}</Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </AppLayout>
  );
}

// `wrap`: long unbroken values (a 24-char EPC) wrap to a second line instead
// of truncating — break-all so web breaks mid-string too. Only applies to
// the plain (non-`onCopy`) branch, since the truncated form is always short.
// `onCopy`: when given, the value renders truncated (first 6 … last 4 chars,
// only when that's actually shorter than the real value) with a copy icon
// that hands the full, untruncated value to the caller (e.g. clipboard).
const DetailRow = ({ icon, label, value, wrap = false, onCopy }: { icon: string; label: string; value: string; wrap?: boolean; onCopy?: () => void }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelWrap}>
      <VectorIcon name={icon} size={21} color={colors.muted} style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    {onCopy ? (
      <View style={styles.detailValueMaskedWrap}>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value && value.length > 14 ? `${value.slice(0, 6)} ... ${value.slice(-4)}` : value}
        </Text>
        <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <VectorIcon name="content-copy" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
    ) : (
      <Text style={[styles.detailValue, wrap && ({ wordBreak: 'break-all' } as any)]} numberOfLines={wrap ? 2 : 1}>{value}</Text>
    )}
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
  statLabel: { fontSize: 17, color: colors.muted },
  statValue: { fontSize: 21, fontWeight: '600', color: colors.text },
  loadingMore: { marginVertical: spacing.lg },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingLeft: 15,
    paddingRight: 6,
  },
  periodButtonText: { fontSize: 18, fontWeight: '600', color: colors.primary },
  periodOverlay: { flex: 1 },
  periodPopover: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    minWidth: 210,
    ...shadow(3),
  },
  periodPopoverItem: { paddingVertical: 13, paddingHorizontal: spacing.md, minHeight: 44 },
  periodPopoverItemActive: { backgroundColor: colors.surfaceAlt },
  periodPopoverText: { fontSize: 20, color: colors.text },
  periodPopoverTextActive: { color: colors.primary, fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.xs },
  // Selected tab: gray background + dark-blue border (not a solid fill).
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 45,
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
  tabText: { fontSize: 18, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl, fontSize: 21 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingLeft: spacing.md, paddingRight: spacing.xs, minHeight: 70 },
  rowImage: { width: 66, height: 66, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, marginRight: spacing.sm },
  rowTagIconBox: {
    width: 66,
    height: 66,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowInfo: { flex: 1, minWidth: 0, marginRight: spacing.xs },
  rowRef: { fontSize: 21, fontWeight: '600', color: colors.text },
  rowRefMaskedWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowTime: { fontSize: 18, color: colors.muted },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  // Latest: outlined (not filled) so it reads distinct from the filled-green Saved badge.
  badgeLatest: { backgroundColor: colors.surface, borderColor: colors.primary },
  badgeLatestText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  badgeSaved: { backgroundColor: colors.success },
  badgeText: { fontSize: 17, color: colors.muted, fontWeight: '600' },
  badgeTextOnColor: { fontSize: 17, color: '#fff', fontWeight: '600' },
  flagButton: { paddingHorizontal: 4, minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // Floating popup (not inline) — anchored near the tap point, same
  // overlay/dismiss pattern as periodOverlay/periodPopover above.
  detailOverlay: { flex: 1 },
  detailPopover: {
    // width set inline (min of 360 and the available screen width)
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow(3),
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: 6 },
  detailLabel: { fontSize: 18, color: colors.muted },
  detailValue: { fontSize: 18, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  detailValueMaskedWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.md },
  copyInfoModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  copyInfoModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 22,
    ...shadow(3),
  },
  copyInfoModalText: {
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 30,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  moreButtonText: { fontSize: 20, color: colors.primary, fontWeight: '600' },
});
