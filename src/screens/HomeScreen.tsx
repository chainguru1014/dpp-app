import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
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

const fileUrl = (raw: string) => {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE_URL}files/${String(raw).replace(/^\/+/, '')}`;
};

export default function HomeScreen({ navigation, user, onLogout }: HomeScreenProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    const uid = encodeURIComponent(String(user._id));
    try {
      const [scanRes, ownedRes, brandRes] = await Promise.all([
        fetch(`${API_BASE_URL}qrcode/scan/list?user_id=${uid}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}transfer/my-products?user_id=${uid}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}engagement/follow/list?user_id=${uid}`).then((r) => r.json()).catch(() => null),
      ]);
      if (scanRes?.status === 'success' && Array.isArray(scanRes.data)) {
        setRecentScans([...scanRes.data].sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0)).slice(0, 3));
      }
      if (ownedRes?.status === 'success' && Array.isArray(ownedRes.data)) {
        setMyProducts(ownedRes.data.slice(0, 3));
      }
      if (brandRes?.status === 'success' && Array.isArray(brandRes.data)) {
        setBrands(
          brandRes.data.slice(0, 8).map((raw: any, i: number) => ({
            id: String(raw?._id ?? i),
            name: String(raw?.brandName ?? raw?.name ?? 'Brand').trim() || 'Brand',
            detail: String(raw?.brandDetail ?? '').trim(),
            website: String(raw?.brandWebsiteUrl ?? raw?.websiteUrl ?? '').trim(),
            logo: fileUrl(String(raw?.brandLogoUrl ?? raw?.logoUrl ?? '').trim()),
            cover: String(raw?.brandCoverUrl ?? '').trim(),
          }))
        );
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
  const openBrand = (b: any) =>
    navigation.navigate('BrandDetail', {
      brand: { name: b.name, detail: b.detail, website: b.website, logoUrl: b.logo, coverUrl: b.cover },
    });

  const scanCaption = (p: any) => {
    const when = p?.scannedAt ? new Date(p.scannedAt) : null;
    const time = when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `${t('scannedLabel')}${time ? ` • ${time}` : ''}`;
  };

  const trust = [
    { icon: 'verified-user', title: t('homeTrustVerify'), sub: t('homeTrustVerifySub') },
    { icon: 'timeline', title: t('homeTrustLifecycle'), sub: t('homeTrustLifecycleSub') },
    { icon: 'workspace-premium', title: t('homeTrustOwnership'), sub: t('homeTrustOwnershipSub') },
  ];

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} logoLeft>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* The one and only way to start a scan from Home — the whole card taps. */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => openScanner()}>
          <ImageBackground
            source={require('../assets/scan-product.png')}
            style={styles.hero}
            imageStyle={styles.heroImage}
            resizeMode="cover"
          >
            <Icon name="crop-free" size={34} color={colors.primary} style={styles.heroBadgeIcon} />
            <Text style={styles.heroTitle}>{t('scanTitle')}</Text>
            <Text style={styles.heroSub}>{t('homeScanHeroSub')}</Text>
            <View style={styles.heroBtn}>
              <Icon name="crop-free" size={20} color="#fff" />
              <Text style={styles.heroBtnText}>{t('homeScanNow')}</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <SectionCard
              title={t('homeRecentScans')}
              onViewAll={() => navigation.navigate('History')}
              emptyText={t('noHistoryYet')}
              hasItems={recentScans.length > 0}
              style={styles.sectionFull}
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
              style={styles.sectionFull}
            >
              {myProducts.map((p, i) => (
                <ProductRow key={`${p._id}-${i}`} product={p} caption={t('owned')} onPress={() => openProductSummary(p, true)} />
              ))}
            </SectionCard>

            {brands.length > 0 && (
              <SectionCard
                title={t('homeFeaturedBrands')}
                onViewAll={() => navigation.navigate('FavoriteBrands')}
                emptyText=""
                hasItems
                style={styles.sectionFull}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandStrip}>
                  {brands.map((b) => (
                    <TouchableOpacity key={b.id} style={styles.brandTile} activeOpacity={0.8} onPress={() => openBrand(b)}>
                      <View style={styles.brandLogoBox}>
                        {b.logo ? (
                          <Image source={{ uri: b.logo }} style={styles.brandLogoImg} resizeMode="contain" />
                        ) : (
                          <Text style={styles.brandLetter}>{b.name.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={styles.brandName} numberOfLines={1}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </SectionCard>
            )}
          </>
        )}

        {/* Trust badges */}
        <View style={styles.trustRow}>
          {trust.map((x) => (
            <View key={x.title} style={styles.trustCol}>
              <Icon name={x.icon} size={20} color={colors.primary} />
              <Text style={styles.trustTitle}>{x.title}</Text>
              <Text style={styles.trustSub} numberOfLines={3}>{x.sub}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  hero: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.lg,
    backgroundColor: '#e6effb',
    // Match the artwork's ~2:1 ratio so the full image (bag + phone) shows
    // without cropping; text sits over the empty left of the illustration.
    aspectRatio: 2,
    justifyContent: 'center',
  },
  heroImage: { borderRadius: radius.xl },
  heroBadgeIcon: { marginBottom: spacing.sm },
  heroTitle: { fontSize: 25, fontWeight: '800', color: colors.heading },
  heroSub: { fontSize: 15, color: colors.text, marginTop: 6, lineHeight: 20, maxWidth: '52%' },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...shadow(1),
  },
  heroBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  brandStrip: { gap: spacing.md, paddingVertical: spacing.xs },
  brandTile: { width: 72, alignItems: 'center' },
  brandLogoBox: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  brandLogoImg: { width: 46, height: 46 },
  brandLetter: { fontSize: 32, fontWeight: '800', color: colors.primary },
  brandName: { fontSize: 17, color: colors.muted, marginTop: 6, textAlign: 'center' },
  sectionFull: { marginHorizontal: 0 },
  trustRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow(1),
  },
  trustCol: { flex: 1, alignItems: 'center' },
  trustTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, marginTop: 6, textAlign: 'center' },
  trustSub: { fontSize: 16, color: colors.muted, marginTop: 3, textAlign: 'center', lineHeight: 19 },
});
