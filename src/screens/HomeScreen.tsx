import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { ProductRow, SectionCard } from '../components/ProductListParts';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

interface HomeScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

const displayName = (user: any) => {
  const raw = String(user?.name || user?.nickname || '').trim();
  if (raw) return raw;
  const email = String(user?.email || '').trim();
  return email ? email.split('@')[0] : 'there';
};

export default function HomeScreen({ navigation, user, onLogout }: HomeScreenProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [myProducts, setMyProducts] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    const uid = encodeURIComponent(String(user._id));
    try {
      const [scanRes, ownedRes] = await Promise.all([
        fetch(`${API_BASE_URL}qrcode/scan/list?user_id=${uid}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}transfer/my-products?user_id=${uid}`).then((r) => r.json()).catch(() => null),
      ]);
      if (scanRes?.status === 'success' && Array.isArray(scanRes.data)) {
        setRecentScans(
          [...scanRes.data].sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0)).slice(0, 3)
        );
      }
      if (ownedRes?.status === 'success' && Array.isArray(ownedRes.data)) {
        setMyProducts(ownedRes.data.slice(0, 3));
      }
    } catch (err) {
      console.error('Home load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openScanner = (params?: any) => navigation.navigate('Scanner', params);
  const openProductSummary = (product: any, owned: boolean) =>
    navigation.navigate('ProductSummary', { product, owned });

  const scanCaption = (p: any) => {
    const when = p?.scannedAt ? new Date(p.scannedAt) : null;
    const time = when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `${t('scannedLabel')}${time ? ` • ${time}` : ''}`;
  };

  const actions = [
    { key: 'camera', icon: 'photo-camera', label: t('homeActionCameraScan'), sub: t('homeActionCameraScanSub'), onPress: () => openScanner() },
    { key: 'upload', icon: 'image', label: t('homeActionUploadImage'), sub: t('homeActionUploadImageSub'), onPress: () => openScanner({ startUpload: true }) },
    { key: 'enter', icon: 'keyboard', label: t('homeActionEnterCode'), sub: t('homeActionEnterCodeSub'), onPress: () => navigation.navigate('EnterCode') },
  ];

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} logoLeft flatContent>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingBand}>
          <Text style={styles.greetingSmall}>{t('homeWelcomeBack')}</Text>
          <Text style={styles.greetingName}>{displayName(user)}</Text>
        </View>

        <View style={styles.scanCard}>
          <TouchableOpacity style={styles.scanHeaderRow} activeOpacity={0.85} onPress={() => openScanner()}>
            <View style={styles.scanIconWrap}>
              <Icon name="qr-code-scanner" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>{t('homeScanProduct')}</Text>
              <Text style={styles.scanSubtitle}>{t('homeScanProductHint')}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.scanDivider} />
          <View style={styles.actionRow}>
            {actions.map((a) => (
              <TouchableOpacity key={a.key} style={styles.actionTile} activeOpacity={0.8} onPress={a.onPress}>
                <Icon name={a.icon} size={22} color={colors.primary} />
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionSub} numberOfLines={2}>{a.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <SectionCard
              title={t('homeRecentScans')}
              onViewAll={() => navigation.navigate('History')}
              emptyText={t('noHistoryYet')}
              hasItems={recentScans.length > 0}
            >
              {recentScans.map((p, i) => (
                <ProductRow key={`${p._id}-${i}`} product={p} caption={scanCaption(p)} onPress={() => openProductSummary(p, false)} />
              ))}
            </SectionCard>

            <SectionCard
              title={t('homeMyProducts')}
              onViewAll={() => navigation.navigate('ScannedProducts')}
              emptyText={t('noOwnedProducts')}
              hasItems={myProducts.length > 0}
            >
              {myProducts.map((p, i) => (
                <ProductRow key={`${p._id}-${i}`} product={p} caption={t('owned')} onPress={() => openProductSummary(p, true)} />
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
  container: { paddingBottom: spacing.xxxl },
  greetingBand: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  greetingSmall: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  greetingName: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 2 },
  scanCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    padding: spacing.md,
    ...shadow(2),
  },
  scanHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  scanIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  scanSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  scanDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 12, fontWeight: '700', color: colors.heading, marginTop: spacing.sm, textAlign: 'center' },
  actionSub: { fontSize: 10, color: colors.muted, marginTop: 2, textAlign: 'center' },
});
