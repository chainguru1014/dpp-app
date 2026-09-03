import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { ProductRow, SectionCard } from './HomeScreen';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow } from '../theme';

interface Props {
  navigation: any;
  user?: any;
  onLogout?: () => void;
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
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? `${t('scannedLabel')} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `${t('scannedLabel')} • ${d.toLocaleDateString()}`;
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} title={t('titleMyProducts')}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.scanCard} activeOpacity={0.85} onPress={() => navigation.navigate('Scanner')}>
          <View style={styles.scanIconWrap}>
            <Icon name="qr-code-scanner" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>{t('homeScanProduct')}</Text>
            <Text style={styles.scanSubtitle}>{t('homeScanProductHint')}</Text>
          </View>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xxxl }} />
        ) : (
          <>
            <SectionCard title={t('homeMyProducts')} emptyText={t('noOwnedProducts')} hasItems={owned.length > 0}>
              {owned.map((p, i) => (
                <ProductRow key={`o-${p._id}-${i}`} product={p} caption={t('owned')} onPress={() => openSummary(p, true)} />
              ))}
            </SectionCard>

            <SectionCard title={t('homeRecentScans')} emptyText={t('noHistoryYet')} hasItems={scans.length > 0}>
              {scans.map((p, i) => (
                <ProductRow key={`s-${p._id}-${i}`} product={p} caption={scanCaption(p)} onPress={() => openSummary(p, false)} />
              ))}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    ...shadow(1),
  },
  scanIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  scanSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
