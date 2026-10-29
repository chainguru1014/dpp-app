import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import GradientButton from '../components/GradientButton';
import ProductReactionBar, { BigIconButton } from '../components/ProductReactionBar';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow } from '../theme';
import { normalizeToStringArray, normalizeToArray } from '../utils/mediaNormalize';
import { fetchPublicProduct, fileUrl, formatPrice } from '../utils/consumerApi';

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
// (route ScanSuccessful) and when a Product Album / Cart card is opened
// (route ProductSummary). Photos, name, short description, price, brand,
// then big icon buttons: Like / Add to Cart / Dislike, and Details / Scan.
export default function ProductSummaryScreen({ navigation, route, user, onLogout }: ProductSummaryScreenProps) {
  const { t } = useI18n();
  // Everything below the slider plus the top and bottom bars takes about
  // 560px, so the slider gets whatever height is left (110–230) and all the
  // buttons stay above the bottom bar on short phones.
  const { height: winH } = useWindowDimensions();
  const sliderHeight = Math.max(110, Math.min(230, winH - 560));
  const params = route?.params || {};
  const [product, setProduct] = useState<any>(params.productData || params.product || {});
  const productId = params.productId ?? product?._id;
  const qrcodeId = params.qrcodeId ?? product?.token_id;
  const securityPassed = !!params.securityPassed;

  // Album / cart rows only carry a snapshot (no videos, no price) — load the
  // full public product when we have its ids.
  useEffect(() => {
    if (productId == null || qrcodeId == null || product?.videos) return undefined;
    let alive = true;
    fetchPublicProduct(String(productId), qrcodeId).then((full) => {
      if (alive && full) setProduct((prev: any) => ({ ...prev, ...full }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, qrcodeId]);

  const requireLogin = () => {
    navigation.navigate('Login', {
      redirectTo: 'ProductSummary',
      redirectParams: { productId: productId != null ? String(productId) : undefined, qrcodeId: qrcodeId != null ? String(qrcodeId) : undefined },
    });
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
  const price = formatPrice(product?.price, product?.currency);

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.navigate('Scanner')}
      title={t('titleProductSummary')}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.mediaCard}>
          <MediaSlider images={images} videos={videos} hideHeader flush maxHeight={sliderHeight} thumbnails getFileUrl={fileUrl} watchLabel={t('watchVideo')} />
        </View>

        <View style={styles.info}>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>{product?.name || '—'}</Text>
          {!!product?.model && <Text style={styles.model} numberOfLines={2}>{product.model}</Text>}
          {!!price && <Text style={styles.price}>{price}</Text>}

          {!!brandName && (
            <GradientButton
              style={styles.brandButton}
              onPress={brandUrl ? () => Linking.openURL(brandUrl).catch(() => {}) : undefined}
              disabled={!brandUrl}
              accessibilityRole={brandUrl ? 'link' : 'text'}
              accessibilityLabel={`${t('summaryBrandCompany')}: ${brandName}${brandUrl ? `. ${t('actOpenBrandSite')}` : ''}`}
            >
              <MaterialCommunityIcon name="storefront-outline" size={30} color={colors.white} />
              <Text style={styles.brandText} numberOfLines={2}>
                <Text style={styles.brandLabel}>{t('summaryBrandCompany')}: </Text>
                <Text style={styles.brandName}>{brandName}</Text>
              </Text>
              {!!brandUrl && <Icon name="open-in-new" size={22} color={colors.white} />}
            </GradientButton>
          )}
        </View>

        <View style={styles.spacer} />

        <ProductReactionBar product={product} user={user} onRequireLogin={requireLogin} />

        <View style={styles.row}>
          <BigIconButton filled icon="text-box-search-outline" label={t('actViewDetails')} caption={t('actDetailsShort')} onPress={goToDetails} />
          <BigIconButton icon="qrcode-scan" label={t('actScanAnother')} caption={t('actScanShort')} onPress={() => navigation.replace('Scanner')} />
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm },
  mediaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    ...shadow(1),
  },
  info: { alignItems: 'center', gap: 4, marginTop: spacing.xs },
  name: { fontSize: 28, fontWeight: '700', color: colors.heading, textAlign: 'center' },
  model: { fontSize: 19, color: colors.muted, textAlign: 'center' },
  price: { fontSize: 26, fontWeight: '800', color: colors.primary, marginTop: 2 },
  // Full-width gradient pill, like the primary buttons below it.
  brandButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadow(2),
  },
  brandText: { flexShrink: 1, fontSize: 19, textAlign: 'center', color: colors.white },
  brandLabel: { fontWeight: '500' },
  brandName: { fontWeight: '800' },
  spacer: { flexGrow: 1, minHeight: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
});
