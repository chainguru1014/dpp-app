import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import GradientView from '../components/GradientView';
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

const fileUrl = (filename: string) => {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE_URL}files/${String(filename).replace(/^\/+/, '')}`;
};

const firstImage = (p: any) => {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  return imgs.length ? fileUrl(imgs[0]) : '';
};

function ProductRow({ product, caption, onPress }: { product: any; caption: string; onPress: () => void }) {
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
    const time = when
      ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return `${t('scannedLabel')}${time ? ` • ${time}` : ''}`;
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} title=" ">
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <GradientView style={styles.hero}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingSmall}>{t('homeWelcomeBack')}</Text>
            <Text style={styles.greetingName}>{displayName(user)}</Text>
          </View>
          <TouchableOpacity style={styles.heroCard} activeOpacity={0.85} onPress={() => openScanner()}>
            <View style={styles.heroIconWrap}>
              <Icon name="qr-code-scanner" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{t('homeScanProduct')}</Text>
              <Text style={styles.heroSubtitle}>{t('homeScanProductHint')}</Text>
            </View>
          </TouchableOpacity>
        </GradientView>

        <View style={styles.body}>
        <View style={styles.actionRow}>
          {[
            { key: 'camera', icon: 'photo-camera', label: t('homeActionCameraScan'), sub: t('homeActionCameraScanSub'), onPress: () => openScanner() },
            { key: 'upload', icon: 'image', label: t('homeActionUploadImage'), sub: t('homeActionUploadImageSub'), onPress: () => openScanner({ startUpload: true }) },
            { key: 'enter', icon: 'keyboard', label: t('homeActionEnterCode'), sub: t('homeActionEnterCodeSub'), onPress: () => navigation.navigate('EnterCode') },
          ].map((a) => (
            <TouchableOpacity key={a.key} style={styles.actionTile} activeOpacity={0.8} onPress={a.onPress}>
              <Icon name={a.icon} size={24} color={colors.primary} />
              <Text style={styles.actionLabel}>{a.label}</Text>
              <Text style={styles.actionSub} numberOfLines={2}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('homeRecentScans')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('History')}>
                  <Text style={styles.viewAll}>{t('viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {recentScans.length === 0 ? (
                <Text style={styles.emptyText}>{t('noHistoryYet')}</Text>
              ) : (
                recentScans.map((p, i) => (
                  <ProductRow
                    key={`${p._id}-${i}`}
                    product={p}
                    caption={scanCaption(p)}
                    onPress={() => openProductSummary(p, false)}
                  />
                ))
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('homeMyProducts')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ScannedProducts')}>
                  <Text style={styles.viewAll}>{t('viewAll')}</Text>
                </TouchableOpacity>
              </View>
              {myProducts.length === 0 ? (
                <Text style={styles.emptyText}>{t('noOwnedProducts')}</Text>
              ) : (
                myProducts.map((p, i) => (
                  <ProductRow
                    key={`${p._id}-${i}`}
                    product={p}
                    caption={t('owned')}
                    onPress={() => openProductSummary(p, true)}
                  />
                ))
              )}
            </View>
          </>
        )}
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { paddingBottom: spacing.xxxl },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  body: { padding: spacing.lg },
  greetingBlock: { marginBottom: spacing.lg },
  greetingSmall: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  greetingName: { fontSize: 26, fontWeight: '700', color: '#fff', marginTop: 2 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow(1),
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  heroSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    ...shadow(1),
  },
  actionLabel: { fontSize: 12, fontWeight: '700', color: colors.heading, marginTop: spacing.sm, textAlign: 'center' },
  actionSub: { fontSize: 10, color: colors.muted, marginTop: 2, textAlign: 'center' },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  viewAll: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  emptyText: { fontSize: 13, color: colors.muted, paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowImage: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  rowImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.heading },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  rowCaption: { fontSize: 11, color: colors.placeholder, marginTop: 2 },
});
