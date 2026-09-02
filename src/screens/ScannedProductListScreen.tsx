import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
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

const fileUrl = (filename: string) => {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE_URL}files/${String(filename).replace(/^\/+/, '')}`;
};
const firstImage = (p: any) => {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  return imgs.length ? fileUrl(imgs[0]) : '';
};

function Row({ product, caption, onPress }: { product: any; caption: string; onPress: () => void }) {
  const img = firstImage(product);
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      {img ? (
        <Image source={{ uri: img }} style={styles.rowImage} resizeMode="cover" />
      ) : (
        <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
          <Icon name="inventory-2" size={20} color={colors.placeholder} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{product?.name || '—'}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{product?.brandInfo?.name || product?.model || ''}</Text>
        <Text style={styles.rowCaption} numberOfLines={1}>{caption}</Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.muted} />
    </TouchableOpacity>
  );
}

export default function ScannedProductListScreen({ navigation, user, onLogout }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    const uid = encodeURIComponent(String(user._id));
    try {
      const [ownedRes, scanRes] = await Promise.all([
        fetch(`${API_BASE_URL}transfer/my-products?user_id=${uid}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}qrcode/scan/list?user_id=${uid}`).then((r) => r.json()).catch(() => null),
      ]);
      if (ownedRes?.status === 'success' && Array.isArray(ownedRes.data)) setOwned(ownedRes.data);
      if (scanRes?.status === 'success' && Array.isArray(scanRes.data)) {
        setScans([...scanRes.data].sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0)));
      }
    } catch (err) {
      console.error('My Products load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openSummary = (product: any, isOwned: boolean) =>
    navigation.navigate('ProductSummary', { product, owned: isOwned });

  const scanCaption = (p: any) => {
    const d = p?.scannedAt ? new Date(p.scannedAt) : null;
    if (!d) return t('scannedLabel');
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? `${t('scannedLabel')} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `${t('scannedLabel')} • ${d.toLocaleDateString()}`;
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xxxl }} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('homeMyProducts')}</Text>
              {owned.length === 0 ? (
                <Text style={styles.emptyText}>{t('noOwnedProducts')}</Text>
              ) : (
                owned.map((p, i) => (
                  <Row key={`o-${p._id}-${i}`} product={p} caption={t('owned')} onPress={() => openSummary(p, true)} />
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('homeRecentScans')}</Text>
              {scans.length === 0 ? (
                <Text style={styles.emptyText}>{t('noHistoryYet')}</Text>
              ) : (
                scans.map((p, i) => (
                  <Row key={`s-${p._id}-${i}`} product={p} caption={scanCaption(p)} onPress={() => openSummary(p, false)} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  emptyText: { fontSize: 13, color: colors.muted, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  rowImage: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  rowImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.heading },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  rowCaption: { fontSize: 11, color: colors.placeholder, marginTop: 2 },
});
