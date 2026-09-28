import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Platform, Modal, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import BottomSafeScrollView from '../components/BottomSafeScrollView';
import GradientButton from '../components/GradientButton';
import GradientView from '../components/GradientView';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow, MIN_TOUCH } from '../theme';

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
  const [productsModalVisible, setProductsModalVisible] = useState(false);
  const [customersModalVisible, setCustomersModalVisible] = useState(false);
  const [customers, setCustomers] = useState<{ name: string | null; country: string }[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersLoaded, setCustomersLoaded] = useState(false);

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

  // Fetched lazily on first open rather than alongside the stats count --
  // most visits never open this dialog, and the count alone is all the
  // Customers tile itself needs.
  const openCustomersModal = () => {
    setCustomersModalVisible(true);
    if (customersLoaded || !website) return;
    setCustomersLoading(true);
    fetch(`${API_BASE_URL}engagement/brand/followers?website=${encodeURIComponent(website)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.status === 'success' && Array.isArray(j.data)) setCustomers(j.data);
        setCustomersLoaded(true);
      })
      .catch(() => {})
      .finally(() => setCustomersLoading(false));
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
      flushBottom
    >
      <BottomSafeScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {/* No large placeholder hero when there's no cover image -- that just
            reserves 210px of blank space for nothing. Skip straight to a
            compact header instead. */}
        {!!coverUrl && (
          <Image source={{ uri: fileUrl(coverUrl) }} style={styles.cover} resizeMode="cover" />
        )}

        <View style={[styles.headerCard, !coverUrl && styles.headerCardNoCover]}>
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
              accessibilityRole="button"
              accessibilityLabel={`${following ? t('unfollowBrand') : t('followBrand')} ${brand.name || ''}`.trim()}
              accessibilityState={{ selected: following }}
            >
              {following && <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} angle="diagonal" />}
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? t('brandsFollowing') : t('brandFollow')}
              </Text>
            </TouchableOpacity>
            {!!website && (
              <TouchableOpacity
                style={styles.websiteBtn}
                onPress={openWebsite}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={website.replace(/^https?:\/\//, '')}
              >
                <Icon name="open-in-new" size={18} color={colors.accent} />
                <Text style={styles.websiteText} numberOfLines={1}>{website.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.statRow}>
          {[
            {
              icon: 'inventory-2',
              value: String(products.length),
              label: products.length === 1 ? t('brandStatProduct') : t('brandStatProducts'),
              onPress: () => setProductsModalVisible(true),
            },
            // Rating has no real data source anywhere in the app yet -- showing a
            // permanent "—" reads as broken, not "unavailable", so it's omitted
            // entirely rather than displayed as a dead placeholder.
            stats.followerCount > 0 && {
              icon: 'group',
              value: String(stats.followerCount),
              label: stats.followerCount === 1 ? t('brandStatCustomer') : t('brandStatCustomers'),
              onPress: openCustomersModal,
            },
            stats.countryCount > 0 && { icon: 'public', value: String(stats.countryCount), label: t('brandStatCountries') },
          ].filter(Boolean).map((s: any) => (
            <TouchableOpacity
              key={s.label}
              style={styles.statTile}
              onPress={s.onPress}
              disabled={!s.onPress}
              activeOpacity={s.onPress ? 0.7 : 1}
              accessibilityRole={s.onPress ? 'button' : undefined}
              accessible
              accessibilityLabel={`${s.value} ${s.label}`}
            >
              <Icon name={s.icon} size={19} color={colors.primary} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('brandFeaturedProducts')}</Text>
          {products.length > 3 && (
            <TouchableOpacity
              style={styles.viewAllTouch}
              onPress={() => setShowAll((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showAll ? t('brandShowLess') : t('viewAll')}
            >
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
                accessibilityRole="button"
                accessibilityLabel={p?.name || t('unnamedProduct')}
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

        <TouchableOpacity
          style={styles.introBtn}
          onPress={() => setIntroVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('brandIntroduceToFriend')}
        >
          <Icon name="share" size={18} color={colors.primary} />
          <Text style={styles.introBtnText}>{t('brandIntroduceToFriend')}</Text>
        </TouchableOpacity>
      </BottomSafeScrollView>

      <Modal visible={introVisible} transparent animationType="slide" onRequestClose={() => setIntroVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('brandIntroduceTitle')}</Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIntroVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
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
            <GradientButton
              style={styles.sheetSend}
              onPress={sendIntroduction}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('brandIntroSend')}
            >
              <Text style={styles.sheetSendText}>{t('brandIntroSend')}</Text>
            </GradientButton>
          </View>
        </View>
      </Modal>

      {/* All Products -- reuses the same row look as the Featured Products
          list below, just unfiltered (that list caps at 3 unless "View all"
          is toggled) and reachable straight from the stat tile. */}
      <Modal visible={productsModalVisible} transparent animationType="slide" onRequestClose={() => setProductsModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, styles.listSheet]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('brandAllProductsTitle')}</Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setProductsModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
                <Icon name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.listSheetContent}>
              {products.length === 0 ? (
                <Text style={styles.emptyText}>{t('brandNoProducts')}</Text>
              ) : (
                products.map((p, i) => {
                  const img = firstImage(p);
                  return (
                    <TouchableOpacity
                      key={`${p._id}-${i}`}
                      style={styles.productRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setProductsModalVisible(false);
                        navigation.navigate('ProductSummary', { product: p, owned: false });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={p?.name || t('unnamedProduct')}
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
            </ScrollView>
            <TouchableOpacity
              style={styles.dialogCloseBtn}
              onPress={() => setProductsModalVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Text style={styles.dialogCloseBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Who's following -- consumer accounts identify via a nickname only
          (never a real name, by design), so `name` falls back to a neutral
          placeholder rather than a blank row when one isn't set. */}
      <Modal visible={customersModalVisible} transparent animationType="slide" onRequestClose={() => setCustomersModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, styles.listSheet]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('brandCustomersTitle')}</Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setCustomersModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
                <Icon name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {customersLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: spacing.xxl }} />
            ) : (
              <ScrollView contentContainerStyle={styles.listSheetContent}>
                {customers.length === 0 ? (
                  <Text style={styles.emptyText}>{t('brandNoCustomersYet')}</Text>
                ) : (
                  customers.map((c, i) => (
                    <View
                      key={i}
                      style={styles.customerRow}
                      accessible
                      accessibilityLabel={[c.name || t('brandAnonymousCustomer'), c.country].filter(Boolean).join(', ')}
                    >
                      <View style={styles.customerAvatar}>
                        <Icon name="person" size={20} color={colors.placeholder} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerName} numberOfLines={1}>{c.name || t('brandAnonymousCustomer')}</Text>
                        {!!c.country && <Text style={styles.customerCountry} numberOfLines={1}>{c.country}</Text>}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.dialogCloseBtn}
              onPress={() => setCustomersModalVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Text style={styles.dialogCloseBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // paddingBottom comes from BottomSafeScrollView (real bottom-bar clearance).
  container: {},
  cover: { width: '100%', height: 210, backgroundColor: colors.surfaceAlt },
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
  headerCardNoCover: { marginTop: spacing.lg },
  headerTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: radius.md },
  logoPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 26, fontWeight: '700', color: colors.heading },
  brandDetail: { fontSize: 18, color: colors.muted, marginTop: 3, lineHeight: 24 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  followBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: 7 },
  followBtnActive: { backgroundColor: colors.primary },
  followBtnText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  followBtnTextActive: { color: '#fff' },
  websiteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minHeight: MIN_TOUCH },
  websiteText: { fontSize: 18, color: colors.accent, flexShrink: 1 },
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
  statValue: { fontSize: 24, fontWeight: '700', color: colors.primary, marginTop: 4 },
  statLabel: { fontSize: 16, color: colors.muted, marginTop: 3, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.primary },
  viewAllTouch: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  viewAll: { fontSize: 19, color: colors.accent, fontWeight: '600' },
  emptyText: { fontSize: 19, color: colors.muted, marginHorizontal: spacing.lg, paddingVertical: spacing.lg },
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
  productName: { fontSize: 20, fontWeight: '600', color: colors.heading },
  productSub: { fontSize: 18, color: colors.muted, marginTop: 2 },
  introBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  introBtnText: { fontSize: 19, fontWeight: '600', color: colors.primary },
  sheetOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, paddingBottom: spacing.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetCloseBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  sheetTitle: { fontSize: 24, fontWeight: '700', color: colors.heading },
  sheetLabel: { fontSize: 18, color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 19,
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
  brandMiniName: { fontSize: 19, fontWeight: '700', color: colors.heading },
  brandMiniDetail: { fontSize: 17, color: colors.muted, marginTop: 2 },
  sheetSend: { marginTop: spacing.lg, backgroundColor: colors.accent, borderRadius: radius.md, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  sheetSendText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  // Capped height (not just content-sized like the intro sheet) so a long
  // products/customers list can't push the Close button off-screen.
  listSheet: { maxHeight: '78%' },
  listSheetContent: { paddingBottom: spacing.sm },
  dialogCloseBtn: {
    marginTop: spacing.md,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCloseBtnText: { fontSize: 19, fontWeight: '600', color: colors.primary },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 19, fontWeight: '600', color: colors.heading },
  customerCountry: { fontSize: 17, color: colors.muted, marginTop: 2 },
});
