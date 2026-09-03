import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface Props {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

type TabKey = 'scanned' | 'purchased' | 'cancelled';

const fileUrl = (f: string) => {
  if (!f) return '';
  if (/^https?:\/\//i.test(f)) return f;
  return `${API_BASE_URL}files/${String(f).replace(/^\/+/, '')}`;
};

interface Row {
  key: string;
  productId?: string;
  tokenId?: any;
  name: string;
  sub: string;
  image: string;
  when?: number;
  raw?: any;
}

export default function HistoryScreen({ navigation, user, onLogout }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>('scanned');
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState<Row[]>([]);
  const [purchased, setPurchased] = useState<Row[]>([]);
  const [cancelled, setCancelled] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    const uid = encodeURIComponent(String(user._id));
    setLoading(true);
    try {
      const [scanRes, purRes] = await Promise.all([
        fetch(`${API_BASE_URL}qrcode/scan/list?user_id=${uid}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}transfer/purchases?user_id=${uid}`).then((r) => r.json()).catch(() => null),
      ]);

      if (scanRes?.status === 'success' && Array.isArray(scanRes.data)) {
        setScanned(
          scanRes.data
            // "Scanned" = the user has a real scan (not just a page visit) for
            // this product. `everScanned` comes from the backend aggregate;
            // fall back to the old field for older responses.
            .filter((p: any) => (p.everScanned ?? p.visitSource !== 'visit'))
            .sort((a: any, b: any) => (b.firstScannedAt || b.scannedAt || 0) - (a.firstScannedAt || a.scannedAt || 0))
            .map((p: any, i: number): Row => ({
              key: `s-${p._id}-${i}`,
              productId: p._id,
              tokenId: p.token_id,
              name: p.name || t('homeProduct'),
              sub: p.brandInfo?.name || p.model || '',
              image: fileUrl(Array.isArray(p.images) ? p.images[0] : ''),
              when: p.firstScannedAt || p.scannedAt,
              raw: p,
            }))
        );
      }

      if (purRes?.status === 'success' && Array.isArray(purRes.data)) {
        const mapRow = (o: any, i: number): Row => ({
          key: `${o._id}-${i}`,
          productId: o.product_id,
          tokenId: o.token_id,
          name: o.name || t('homeProduct'),
          sub: [o.brandName || o.model, o.quantity ? `×${o.quantity}` : ''].filter(Boolean).join(' · '),
          image: fileUrl(o.image || ''),
          when: o.time ? new Date(o.time).getTime() : undefined,
          raw: o,
        });
        setPurchased(purRes.data.filter((o: any) => o.status === 'confirmed').map(mapRow));
        setCancelled(
          purRes.data.filter((o: any) => o.status === 'rejected' || o.status === 'cancelled').map(mapRow)
        );
      }
    } catch (e) {
      console.error('History load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user?._id, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rows = tab === 'scanned' ? scanned : tab === 'purchased' ? purchased : cancelled;

  const openRow = (row: Row) => {
    if (!row.productId) return;
    navigation.navigate('ProductHistory', {
      productId: row.productId,
      tokenId: row.tokenId,
      product: row.raw,
      name: row.name,
    });
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <View style={styles.screen}>
        <View style={styles.tabRow}>
          {([
            { key: 'scanned' as const, label: t('historyTabScanned') },
            { key: 'purchased' as const, label: t('historyTabPurchased') },
            { key: 'cancelled' as const, label: t('historyTabCancelled') },
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
        ) : rows.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('noHistoryYet')}</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {rows.map((row) => (
              <TouchableOpacity key={row.key} style={styles.row} activeOpacity={0.7} onPress={() => openRow(row)}>
                {row.image ? (
                  <Image source={{ uri: row.image }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}><Icon name="inventory-2" size={18} color={colors.placeholder} /></View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                  {!!row.sub && <Text style={styles.sub} numberOfLines={1}>{row.sub}</Text>}
                  {!!row.when && <Text style={styles.time}>{new Date(row.when).toLocaleDateString()}</Text>}
                </View>
                <Icon name="chevron-right" size={20} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
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
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  thumb: { width: 48, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.heading },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  time: { fontSize: 11, color: colors.placeholder, marginTop: 3 },
});
