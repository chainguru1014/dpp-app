import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

interface HomeScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

interface LocationStep {
  entity: string;
}

const TYPE_META: Record<string, { labelKey: string; color: string }> = {
  scan: { labelKey: 'scannedLabel', color: colors.primary },
  visit: { labelKey: 'visited', color: colors.primaryDark },
  like: { labelKey: 'liked', color: colors.success },
  dislike: { labelKey: 'disliked', color: colors.danger },
  buy: { labelKey: 'buy', color: colors.accent },
  transfer: { labelKey: 'transferred', color: colors.navy },
  receive: { labelKey: 'received', color: colors.accent },
};

const SELECTED_STEP_STORAGE_KEY = 'scanLocationStepIndex';
// Cached display label for the currently selected step — read by AppLayout
// (on every consumer screen) to show as a subtitle under the page title,
// without AppLayout needing to fetch the steps list itself.
const SELECTED_STEP_LABEL_STORAGE_KEY = 'consumerSelectedLocationLabel';

// Shared height for both the location tiles and the stat tiles below them so
// the two rows visually align (see locationTile/statTile styles).
const TILE_HEIGHT = 58;

// Consumer Home — a simple stats dashboard (owned-products + scan-history
// analytics) instead of the old banner slider. Reuses the same endpoints
// ScannedProductListScreen/HistoryScreen already call — no new backend work.
export default function HomeScreen({ navigation, user, onLogout }: HomeScreenProps) {
  const { t } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [ownedCount, setOwnedCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [steps, setSteps] = useState<LocationStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<number>(0);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_STEP_STORAGE_KEY).then((stored) => {
      if (stored != null) setSelectedStep(Number(stored));
    });
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}platform-settings/consumer-location-steps`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.status === 'success') {
          setSteps(data.data?.processSteps || []);
        }
      } catch (err) {
        console.error('Failed to load consumer location steps:', err);
      }
    })();
  }, []);

  // Keep the cached subtitle label (read by AppLayout on every other screen)
  // in sync whenever the steps list loads or the selection changes.
  useEffect(() => {
    const step = steps[selectedStep];
    if (!step) return;
    AsyncStorage.setItem(SELECTED_STEP_LABEL_STORAGE_KEY, step.entity).catch(() => {});
  }, [steps, selectedStep]);

  const handleSelectScanLocation = (index: number) => {
    setSelectedStep(index);
    AsyncStorage.setItem(SELECTED_STEP_STORAGE_KEY, String(index)).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      if (!user?._id) {
        setLoading(false);
        return;
      }
      const uid = encodeURIComponent(String(user._id));
      try {
        const [ownedRes, soldRes, scanRes, activityRes] = await Promise.all([
          fetch(`${API_BASE_URL}transfer/my-products?user_id=${uid}`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}transfer/sold?user_id=${uid}`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}qrcode/scan/list?user_id=${uid}`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}transfer/activity?user_id=${uid}`).then((r) => r.json()).catch(() => null),
        ]);

        if (ownedRes?.status === 'success' && Array.isArray(ownedRes.data)) setOwnedCount(ownedRes.data.length);
        if (soldRes?.status === 'success' && Array.isArray(soldRes.data)) setSoldCount(soldRes.data.length);
        if (scanRes?.status === 'success' && Array.isArray(scanRes.data)) setScannedCount(scanRes.data.length);
        if (activityRes?.status === 'success' && Array.isArray(activityRes.data)) {
          const counts: Record<string, number> = {};
          activityRes.data.forEach((item: any) => {
            counts[item.type] = (counts[item.type] || 0) + 1;
          });
          setActivityCounts(counts);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id]);

  const activityRows = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]);
  const maxActivity = Math.max(1, ...activityRows.map(([, count]) => count));
  const barMaxWidth = Math.min(windowWidth - 140, 220);

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text style={styles.selectorTitle}>{t('locSelectorTitle')}</Text>
        <Text style={styles.selectorSubtitle}>{t('locSelectorSubtitle')}</Text>
        <View style={styles.locationGrid}>
          {Array.from({ length: Math.ceil(steps.length / 2) }, (_, rowIndex) => (
            <View key={rowIndex} style={styles.locationRow}>
              {steps.slice(rowIndex * 2, rowIndex * 2 + 2).map((step, i) => {
                const index = rowIndex * 2 + i;
                const selected = selectedStep === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.locationTile, selected && styles.locationTileSelected]}
                    onPress={() => handleSelectScanLocation(index)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.locationNumberPart, selected && styles.locationNumberPartSelected]}>
                      <Text style={[styles.locationNumberText, selected && styles.locationNumberTextSelected]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.locationTextPart}>
                      <Text style={styles.locationEntityText} numberOfLines={1}>{step.entity}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.statRow}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{ownedCount}</Text>
                <Text style={styles.statLabel}>{t('dashboardOwnedProducts')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{soldCount}</Text>
                <Text style={styles.statLabel}>{t('dashboardSold')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{scannedCount}</Text>
                <Text style={styles.statLabel}>{t('dashboardScanned')}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('dashboardActivityBreakdown')}</Text>
              {activityRows.length === 0 ? (
                <Text style={styles.emptyText}>{t('dashboardNoActivity')}</Text>
              ) : (
                activityRows.map(([type, count]) => {
                  const meta = TYPE_META[type];
                  const width = Math.max(6, (count / maxActivity) * barMaxWidth);
                  return (
                    <View key={type} style={styles.barRow}>
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {meta ? t(meta.labelKey as any) : type}
                      </Text>
                      <Svg width={barMaxWidth} height={16}>
                        <Rect x={0} y={2} width={width} height={12} rx={6} fill={meta?.color || colors.primary} />
                      </Svg>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        <View style={styles.downloadCard}>
          <Text style={styles.downloadTitle}>{t('dashboardDownloadTitle')}</Text>
          <Text style={styles.downloadBody}>{t('dashboardDownloadBody')}</Text>
          <TouchableOpacity style={styles.downloadButton} onPress={() => navigation.navigate('ShopNow')} activeOpacity={0.85}>
            <Text style={styles.downloadButtonText}>{t('dashboardDownloadButton')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  // Two-part card — left is a number "chip" (gray bg/blue text unselected,
  // dark-blue bg/white text selected), right is the step's name only (no
  // type/icon — always white bg, unchanged by selection — only the card's
  // border turns dark blue). Both sides share TILE_HEIGHT so they align
  // with each other and with the stat row below.
  selectorTitle: { fontSize: 22, fontWeight: '600', color: colors.heading, marginBottom: spacing.xs },
  selectorSubtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg },
  locationGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  locationRow: { flexDirection: 'row', gap: spacing.sm },
  locationTile: {
    flex: 1,
    flexDirection: 'row',
    minHeight: TILE_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow(1),
  },
  locationTileSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  locationNumberPart: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  locationNumberPartSelected: {
    backgroundColor: colors.primary,
  },
  locationNumberText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  locationNumberTextSelected: { color: '#fff' },
  locationTextPart: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  locationEntityText: { fontSize: 14, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statTile: {
    flex: 1,
    minHeight: TILE_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow(1),
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.heading, marginBottom: spacing.md },
  emptyText: { fontSize: 13, color: colors.muted },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  barLabel: { width: 70, fontSize: 12, color: colors.text },
  barCount: { width: 28, fontSize: 12, color: colors.muted, textAlign: 'right' },
  downloadCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow(3),
  },
  downloadTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: spacing.xs },
  downloadBody: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  downloadButton: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  downloadButtonText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
