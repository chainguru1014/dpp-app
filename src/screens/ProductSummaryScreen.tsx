import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow } from '../theme';
import { normalizeToStringArray, normalizeToArray } from '../utils/mediaNormalize';
import { fetchPublicProduct, fileUrl, getReactionState, Reaction, setInCart, setReaction } from '../utils/consumerApi';

interface ProductSummaryScreenProps {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

const websiteHref = (url?: string) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

// The consumer product summary — shown right after a successful scan
// (route ScanSuccessful) and when a Product Album card is opened (route
// ProductSummary). Deliberately minimal: photos, name, brand link, then big
// icon buttons — Like (save to album) / Add to Cart / Dislike, and Product
// details / Scan another.
export default function ProductSummaryScreen({ navigation, route, user, onLogout }: ProductSummaryScreenProps) {
  const { t } = useI18n();
  const params = route?.params || {};
  const [product, setProduct] = useState<any>(params.productData || params.product || {});
  const productId = params.productId ?? product?._id;
  const qrcodeId = params.qrcodeId ?? product?.token_id;
  const securityPassed = !!params.securityPassed;

  const [reaction, setReactionState] = useState<Reaction>(null);
  const [inCart, setInCartState] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<any>(null);

  const isConsumer = !!user?._id && user?.actorKind !== 'Employee';

  // Album / cart rows only carry a snapshot (no videos, no price) — load the
  // full public product when we have its ids.
  useEffect(() => {
    if (productId == null || qrcodeId == null || product?.videos) return;
    let alive = true;
    fetchPublicProduct(String(productId), qrcodeId).then((full) => {
      if (alive && full) setProduct((prev: any) => ({ ...prev, ...full }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, qrcodeId]);

  useEffect(() => {
    if (!isConsumer || !product?._id) return;
    let alive = true;
    getReactionState(String(user._id), product)
      .then((s) => {
        if (!alive) return;
        setReactionState(s.reaction);
        setInCartState(s.inCart);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsumer, product?._id]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setToast(''));
    }, 1800);
  };

  const requireLogin = () => {
    navigation.navigate('Login', {
      redirectTo: 'ProductSummary',
      redirectParams: { productId: productId != null ? String(productId) : undefined, qrcodeId: qrcodeId != null ? String(qrcodeId) : undefined },
    });
  };

  const onReact = async (next: 'like' | 'dislike') => {
    if (!isConsumer) return requireLogin();
    if (pending || !product?._id) return;
    const target: Reaction = reaction === next ? null : next;
    const prev = reaction;
    setReactionState(target);
    setPending(next);
    try {
      await setReaction(String(user._id), product, target);
      if (target === 'like') showToast(t('toastSavedToAlbum'));
      else if (target === 'dislike') showToast(t('toastDisliked'));
      else if (prev === 'like') showToast(t('toastRemovedFromAlbum'));
    } catch (e) {
      setReactionState(prev);
      showToast(t('toastActionFailed'));
    } finally {
      setPending(null);
    }
  };

  const onCart = async () => {
    if (!isConsumer) return requireLogin();
    if (pending || !product?._id) return;
    const next = !inCart;
    setInCartState(next);
    setPending('cart');
    try {
      await setInCart(product, next);
      showToast(next ? t('toastAddedToCart') : t('toastRemovedFromCart'));
    } catch (e) {
      setInCartState(!next);
      showToast(t('toastActionFailed'));
    } finally {
      setPending(null);
    }
  };

  const goToDetails = () => {
    const hasIds = productId != null && qrcodeId != null;
    navigation.navigate('Result', {
      securityPassed,
      ...(hasIds ? { productId: String(productId), qrcodeId: String(qrcodeId) } : { productData: product }),
    });
  };

  const images = normalizeToStringArray(product?.images);
  const videos = normalizeToArray(product?.videos);
  const brandName = product?.brandInfo?.name || product?.company_id?.name || '';
  const brandUrl = websiteHref(product?.brandInfo?.websiteUrl);

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('Scanner'))}
      title={t('titleProductSummary')}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.mediaCard}>
          <MediaSlider images={images} videos={videos} hideHeader flush maxHeight={300} getFileUrl={fileUrl} watchLabel={t('watchVideo')} />
        </View>

        <Text style={styles.name} accessibilityRole="header" numberOfLines={3}>{product?.name || '—'}</Text>

        {!!brandName && (
          brandUrl ? (
            <TouchableOpacity
              style={styles.brandLink}
              onPress={() => Linking.openURL(brandUrl).catch(() => {})}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={`${brandName}. ${t('actOpenBrandSite')}`}
            >
              <MaterialCommunityIcon name="storefront-outline" size={24} color={colors.headerLight} />
              <Text style={styles.brandLinkText} numberOfLines={1}>{brandName}</Text>
              <Icon name="open-in-new" size={20} color={colors.headerLight} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.brandPlain} numberOfLines={1}>{brandName}</Text>
          )
        )}

        <View style={styles.spacer} />

        <View style={styles.row}>
          <BigIconButton
            icon={reaction === 'like' ? 'heart' : 'heart-outline'}
            color={colors.danger}
            active={reaction === 'like'}
            activeBg={colors.dangerSoft}
            label={t('actLike')}
            busy={pending === 'like'}
            onPress={() => onReact('like')}
          />
          <BigIconButton
            icon={inCart ? 'cart-check' : 'cart-plus'}
            color={colors.primary}
            active={inCart}
            activeBg={colors.surfaceAlt}
            label={t('actAddToCart')}
            busy={pending === 'cart'}
            onPress={onCart}
          />
          <BigIconButton
            icon={reaction === 'dislike' ? 'thumb-down' : 'thumb-down-outline'}
            color={colors.muted}
            active={reaction === 'dislike'}
            activeBg={colors.surfaceAlt}
            label={t('actDislike')}
            busy={pending === 'dislike'}
            onPress={() => onReact('dislike')}
          />
        </View>

        <View style={styles.row}>
          <BigIconButton wide filled icon="text-box-search-outline" label={t('actViewDetails')} onPress={goToDetails} />
          <BigIconButton wide icon="qrcode-scan" color={colors.primary} label={t('actScanAnother')} onPress={() => navigation.replace('Scanner')} />
        </View>
      </ScrollView>

      {!!toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </AppLayout>
  );
}

// Icon-only action button (the label is for screen readers). `active` fills
// the background so the chosen state reads at a glance.
function BigIconButton({
  icon,
  label,
  onPress,
  color = colors.primary,
  active = false,
  activeBg,
  busy = false,
  wide = false,
  filled = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  active?: boolean;
  activeBg?: string;
  busy?: boolean;
  wide?: boolean;
  filled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.bigBtn,
        wide && styles.bigBtnWide,
        filled && styles.bigBtnFilled,
        active && { backgroundColor: activeBg, borderColor: color },
        busy && { opacity: 0.6 },
      ]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, busy }}
    >
      <MaterialCommunityIcon name={icon} size={wide ? 46 : 50} color={filled ? colors.white : color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
  mediaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    ...shadow(1),
  },
  name: { fontSize: 28, fontWeight: '700', color: colors.heading, textAlign: 'center', marginTop: spacing.xs },
  brandLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    maxWidth: '100%',
  },
  brandLinkText: { fontSize: 21, fontWeight: '600', color: colors.headerLight, textDecorationLine: 'underline', flexShrink: 1 },
  brandPlain: { fontSize: 21, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  spacer: { flexGrow: 1, minHeight: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  bigBtn: {
    flex: 1,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  bigBtnWide: { height: 80 },
  bigBtnFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 110,
    backgroundColor: 'rgba(18,58,86,0.95)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    maxWidth: '90%',
    ...shadow(3),
  },
  toastText: { color: colors.white, fontSize: 18, fontWeight: '600', textAlign: 'center' },
});
