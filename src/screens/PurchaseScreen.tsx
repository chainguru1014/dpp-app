import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, ActivityIndicator } from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import { normalizeToStringArray, normalizeToArray } from '../utils/mediaNormalize';
import { useI18n } from '../i18n/I18nContext';
import { fileUrl, formatPrice, recordPurchase, shopUrlOf } from '../utils/consumerApi';
import { colors, radius, spacing, shadow } from '../theme';

// One product's purchase page (from the Cart's Buy button): photo, name,
// brand, price and a big Buy button that opens the brand's shop page for it
// (product.purchaseUrl, else the brand website) and records the purchase.
export default function PurchaseScreen({ navigation, route, user, onLogout }: any) {
  const { t } = useI18n();
  const product = route?.params?.product || {};
  const [busy, setBusy] = useState(false);
  const images = normalizeToStringArray(product?.images);
  const videos = normalizeToArray(product?.videos);
  const price = formatPrice(product.price, product.currency);
  const shopUrl = shopUrlOf(product);

  const buy = async () => {
    if (!shopUrl || busy) return;
    setBusy(true);
    try {
      if (user?._id && product?._id) await recordPurchase(String(user._id), product).catch(() => {});
      await Linking.openURL(shopUrl);
    } catch (e) {
      console.error('Open shop failed:', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton title={t('titlePurchase')}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <View style={styles.imageCard}>
          <MediaSlider images={images} videos={videos} hideHeader flush maxHeight={300} getFileUrl={fileUrl} watchLabel={t('watchVideo')} />
        </View>
        <Text style={styles.name}>{product.name || '—'}</Text>
        {!!product.brandInfo?.name && <Text style={styles.brand}>{product.brandInfo.name}</Text>}
        <Text style={[styles.price, !price && styles.priceMuted]}>{price || t('priceOnRequest')}</Text>

        <View style={styles.spacer} />

        {shopUrl ? (
          <TouchableOpacity
            style={[styles.buyBtn, busy && { opacity: 0.7 }]}
            onPress={buy}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('purchaseBuyNow')}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <MaterialCommunityIcon name="shopping" size={40} color={colors.white} />}
            <Text style={styles.buyText}>{t('purchaseBuyNow')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noLink}>{t('purchaseNoLink')}</Text>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm },
  imageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    ...shadow(1),
  },
  name: { fontSize: 26, fontWeight: '700', color: colors.heading, textAlign: 'center', marginTop: spacing.md },
  brand: { fontSize: 19, color: colors.muted, textAlign: 'center' },
  price: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center', marginTop: spacing.sm },
  priceMuted: { fontSize: 20, fontWeight: '500', color: colors.muted },
  spacer: { flexGrow: 1, minHeight: spacing.lg },
  buyBtn: {
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadow(2),
  },
  buyText: { color: colors.white, fontSize: 24, fontWeight: '700' },
  noLink: { fontSize: 18, color: colors.muted, textAlign: 'center' },
});
