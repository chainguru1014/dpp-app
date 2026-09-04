import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Platform, Modal, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface Props {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

const fileUrl = (raw: string) => {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE_URL}files/${raw.replace(/^\/+/, '')}`;
};
const firstImage = (p: any) => {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  return imgs.length ? fileUrl(imgs[0]) : '';
};
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

export default function BrandDetailScreen({ navigation, route, user, onLogout }: Props) {
  const { t } = useI18n();
  const brand = route?.params?.brand || {};
  const website = String(brand.website || '').trim();

  const [following, setFollowing] = useState(true);
  const [stats, setStats] = useState<{ followerCount: number; countryCount: number }>({ followerCount: 0, countryCount: 0 });
  const [products, setProducts] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  const [introEmail, setIntroEmail] = useState('');
  const [introMessage, setIntroMessage] = useState('');
  // Cover / logo can arrive from the follow row or be backfilled from a product.
  const [coverUrl, setCoverUrl] = useState<string>(brand.coverUrl || '');
  const [logoUrl, setLogoUrl] = useState<string>(brand.logoUrl || '');
  const [brandDetail, setBrandDetail] = useState<string>(brand.detail || '');

  useEffect(() => {
    if (!website) return;
    const w = encodeURIComponent(website);
    fetch(`${API_BASE_URL}engagement/brand/stats?website=${w}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.status === 'success') setStats({ followerCount: j.followerCount || 0, countryCount: j.countryCount || 0 });
      })
      .catch(() => {});
    fetch(`${API_BASE_URL}product/by-brand?website=${w}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.status === 'success' && Array.isArray(j.data)) {
          setProducts(j.data);
          const bi = j.data[0]?.brandInfo;
          if (bi) {
            setCoverUrl((c) => c || bi.coverUrl || '');
            setLogoUrl((l) => l || bi.logoUrl || '');
            setBrandDetail((d) => d || bi.detail || '');
          }
        }
      })
      .catch(() => {});
    if (user?._id) {
      fetch(`${API_BASE_URL}engagement/follow/status?user_id=${encodeURIComponent(String(user._id))}&brandWebsiteUrl=${w}`)
        .then((r) => r.json())
        .then((j) => setFollowing(!!j?.following))
        .catch(() => {});
    }
  }, [website, user?._id]);

  const toggleFollow = async () => {
    if (!user?._id || !website) return;
    const next = !following;
    setFollowing(next);
    try {
      await fetch(`${API_BASE_URL}engagement/follow`, {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user._id,
          brandWebsiteUrl: website,
          brandName: brand.name,
          brandDetail: brand.detail,
          brandLogoUrl: brand.logoUrl || '',
        }),
      });
      setStats((s) => ({ ...s, followerCount: Math.max(0, s.followerCount + (next ? 1 : -1)) }));
    } catch (e) {
      setFollowing(!next);
    }
  };

  const openWebsite = () => {
    if (!website) return;
    const safe = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    if (Platform.OS === 'web') (globalThis as any)?.open?.(safe, '_blank', 'noopener,noreferrer');
    else Linking.openURL(safe).catch(() => {});
  };

  const sendIntroduction = async () => {
    if (!isValidEmail(introEmail)) {
      Alert.alert(t('error'), 'Please enter a valid email address');
      return;
    }
    const content = [
      `Brand: ${brand.name}`,
      brandDetail ? `About: ${brandDetail}` : '',
      website ? `Website: ${website}` : '',
      introMessage ? `\n${introMessage}` : '',
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch(`${API_BASE_URL}engagement/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: introEmail.trim(), subject: `${brand.name} — a brand you might like`, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Failed to send');
      setIntroVisible(false);
      setIntroEmail('');
      setIntroMessage('');
      Alert.alert(t('success'), t('brandIntroSent'));
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || 'Failed to send introduction');
    }
  };

  const featured = showAll ? products : products.slice(0, 3);

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.goBack()}
      title={brand.name || t('titleBrandDetail')}
      rightIcon="share"
      onShare={() => setIntroVisible(true)}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {coverUrl ? (
          <Image source={{ uri: fileUrl(coverUrl) }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Icon name="image" size={30} color="rgba(255,255,255,0.7)" />
          </View>
        )}

        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            {logoUrl ? (
              <Image source={{ uri: fileUrl(logoUrl) }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}><Icon name="storefront" size={26} color={colors.placeholder} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName}>{brand.name || '—'}</Text>
              {!!brandDetail && <Text style={styles.brandDetail} numberOfLines={2}>{brandDetail}</Text>}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followBtnActive]}
              onPress={toggleFollow}
              activeOpacity={0.8}
            >
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? t('brandsFollowing') : t('brandFollow')}
              </Text>
            </TouchableOpacity>
            {!!website && (
              <TouchableOpacity style={styles.websiteBtn} onPress={openWebsite} activeOpacity={0.7}>
                <Icon name="open-in-new" size={18} color={colors.accent} />
                <Text style={styles.websiteText} numberOfLines={1}>{website.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.statRow}>
          {[
            { icon: 'inventory-2', value: String(products.length), label: t('brandStatProducts') },
            { icon: 'star-border', value: '—', label: t('brandStatRating') },
            { icon: 'group', value: String(stats.followerCount), label: t('brandStatCustomers') },
            { icon: 'public', value: String(stats.countryCount), label: t('brandStatCountries') },
          ].map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Icon name={s.icon} size={19} color={colors.primary} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('brandFeaturedProducts')}</Text>
          {products.length > 3 && (
            <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
              <Text style={styles.viewAll}>{showAll ? t('brandShowLess') : t('viewAll')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {featured.length === 0 ? (
          <Text style={styles.emptyText}>{t('brandNoProducts')}</Text>
        ) : (
          featured.map((p, i) => {
            const img = firstImage(p);
            return (
              <TouchableOpacity
                key={`${p._id}-${i}`}
                style={styles.productRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ProductSummary', { product: p, owned: false })}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.productImage, styles.productImagePlaceholder]}>
                    <Icon name="inventory-2" size={20} color={colors.placeholder} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>{p?.name || '—'}</Text>
                  <Text style={styles.productSub} numberOfLines={1}>{p?.model || p?.brandInfo?.name || ''}</Text>
                </View>
                <Icon name="chevron-right" size={22} color={colors.muted} />
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity style={styles.introBtn} onPress={() => setIntroVisible(true)} activeOpacity={0.8}>
          <Icon name="share" size={18} color={colors.primary} />
          <Text style={styles.introBtnText}>{t('brandIntroduceToFriend')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={introVisible} transparent animationType="slide" onRequestClose={() => setIntroVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('brandIntroduceTitle')}</Text>
              <TouchableOpacity onPress={() => setIntroVisible(false)}>
                <Icon name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetLabel}>{t('brandIntroRecipient')}</Text>
            <TextInput
              style={styles.input}
              value={introEmail}
              onChangeText={setIntroEmail}
              placeholder="friend@example.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.brandMini}>
              {logoUrl ? (
                <Image source={{ uri: fileUrl(logoUrl) }} style={styles.brandMiniLogo} resizeMode="contain" />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.brandMiniName}>{brand.name}</Text>
                {!!brandDetail && <Text style={styles.brandMiniDetail} numberOfLines={1}>{brandDetail}</Text>}
              </View>
            </View>
            <Text style={styles.sheetLabel}>{t('brandIntroMessage')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={introMessage}
              onChangeText={(v) => setIntroMessage(v.slice(0, 200))}
              placeholder={t('brandIntroMessagePlaceholder')}
              placeholderTextColor={colors.placeholder}
              multiline
            />
            <GradientButton style={styles.sheetSend} onPress={sendIntroduction} activeOpacity={0.85}>
              <Text style={styles.sheetSendText}>{t('brandIntroSend')}</Text>
            </GradientButton>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { paddingBottom: spacing.xxxl },
  cover: { width: '100%', height: 210, backgroundColor: colors.surfaceAlt },
  coverPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    // Pull the card up so it sits partially over the cover image (screenshot #6).
    marginTop: -48,
    marginBottom: spacing.md,
    ...shadow(2),
  },
  headerTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: radius.md },
  logoPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 19, fontWeight: '700', color: colors.heading },
  brandDetail: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  followBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 7 },
  followBtnActive: { backgroundColor: colors.primary },
  followBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  followBtnTextActive: { color: '#fff' },
  websiteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  websiteText: { fontSize: 13, color: colors.accent, flexShrink: 1 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: 4 },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 3, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  viewAll: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.muted, marginHorizontal: spacing.lg, paddingVertical: spacing.lg },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  productImage: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '600', color: colors.heading },
  productSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  introBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  introBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  sheetOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, paddingBottom: spacing.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.heading },
  sheetLabel: { fontSize: 13, color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  brandMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  brandMiniLogo: { width: 64, height: 46 },
  brandMiniName: { fontSize: 14, fontWeight: '700', color: colors.heading },
  brandMiniDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sheetSend: { marginTop: spacing.lg, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  sheetSendText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
