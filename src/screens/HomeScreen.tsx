import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

interface HomeScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
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

const SCAN_LOCATION_STORAGE_KEY = 'scanLocationType';

// Shared height for both the location tiles and the stat tiles below them so
// the two rows visually align (see locationTile/statTile styles).
const TILE_HEIGHT = 64;

// Where the consumer is scanning from — purely a local preference today (no
// backend field yet to attach it to); persisted so it survives app restarts.
const SCAN_LOCATION_TYPES: { key: string; labelKey: string; icon: string }[] = [
  { key: 'store', labelKey: 'locTypeStore', icon: 'store' },
  { key: 'factory', labelKey: 'locTypeFactory', icon: 'factory' },
  { key: 'warehouse', labelKey: 'locTypeWarehouse', icon: 'warehouse' },
  { key: 'p2p', labelKey: 'locTypeP2P', icon: 'swap-horiz' },
  { key: 'home', labelKey: 'locTypeHome', icon: 'home' },
  { key: 'other', labelKey: 'locTypeOther', icon: 'more-horiz' },
];

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
  const [scanLocationType, setScanLocationType] = useState<string>('store');

  useEffect(() => {
    AsyncStorage.getItem(SCAN_LOCATION_STORAGE_KEY).then((stored) => {
      if (stored) setScanLocationType(stored);
    });
  }, []);

  const handleSelectScanLocation = (key: string) => {
    setScanLocationType(key);
    AsyncStorage.setItem(SCAN_LOCATION_STORAGE_KEY, key).catch(() => {});
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
          {[0, 1, 2].map((rowIndex) => (
            <View key={rowIndex} style={styles.locationRow}>
              {SCAN_LOCATION_TYPES.slice(rowIndex * 2, rowIndex * 2 + 2).map((opt, i) => {
                const index = rowIndex * 2 + i;
                const selected = scanLocationType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.locationTile, selected && styles.locationTileSelected]}
                    onPress={() => handleSelectScanLocation(opt.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.locationNumberPart, selected && styles.locationNumberPartSelected]}>
                      <Text style={[styles.locationNumberText, selected && styles.locationNumberTextSelected]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.locationIconPart}>
                      <VectorIcon name={opt.icon} size={20} color="#141a24" />
                      <Text style={styles.locationTileText} numberOfLines={1}>
                        {t(opt.labelKey as any)}
                      </Text>
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
  // dark-blue bg/white text selected), right is icon+label (always white
  // bg/near-black text, unchanged by selection — only the card's border
  // turns dark blue). Both sides share TILE_HEIGHT so they align with each
  // other and with the stat row below.
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
  locationIconPart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  locationTileText: { fontSize: 13, fontWeight: '600', color: '#141a24', flexShrink: 1 },
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
