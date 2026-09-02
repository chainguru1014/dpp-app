import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import VideoPlayerModal from '../components/VideoPlayerModal';
import GradientButton from '../components/GradientButton';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow } from '../theme';

interface ProductSummaryScreenProps {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  denim: 'Denim',
  tops: 'Tops',
  bottoms: 'Bottoms',
  outerwear: 'Outerwear',
  others: 'Other',
};

export default function ProductSummaryScreen({ navigation, route, user, onLogout }: ProductSummaryScreenProps) {
  const { t } = useI18n();
  const product = route?.params?.product || {};
  const owned = !!route?.params?.owned;
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const images = Array.isArray(product?.images) ? product.images : [];
  const videos = Array.isArray(product?.videos) ? product.videos : [];

  const warranty = product?.warrantyAndGuarantee?.warranty;
  const warrantyActive = !!(warranty && (warranty.lifetime || warranty.period));
  const warrantyLabel = warranty?.lifetime
    ? t('summaryLifetime')
    : warranty?.period
    ? `${warranty.period}`
    : '';

  const rows: { label: string; value: string }[] = [
    { label: t('summaryBrand'), value: product?.brandInfo?.name || '' },
    { label: t('summaryCategory'), value: CATEGORY_LABEL[product?.itemCategory] || '' },
    { label: t('summarySerialNumber'), value: product?.skuStyleNumber || (product?.token_id != null ? String(product.token_id) : '') },
    { label: t('summaryMaterial'), value: product?.detailFacts?.material || product?.materialSize?.size || '' },
    { label: t('summaryModel'), value: product?.model || '' },
    { label: t('summaryWarrantyStatus'), value: warrantyActive ? t('summaryActive') : '' },
    { label: t('summaryValidUntil'), value: warrantyLabel && !warranty?.lifetime ? '' : (warranty?.lifetime ? t('summaryLifetime') : '') },
  ].filter((r) => !!r.value);

  const goToDetails = () =>
    navigation.navigate('Result', {
      productData: product,
      productId: product?._id,
      qrcodeId: product?.token_id != null ? String(product.token_id) : undefined,
      owned,
    });

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton product={product}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <MediaSlider
          images={images}
          videos={videos}
          name={product?.name}
          model={product?.model}
          pmcCode={product?.pmc_code}
          watchLabel={t('watchVideo')}
          onPlayVideo={setPlayingVideoId}
        />

        <View style={styles.verifiedRow}>
          <Icon name="verified" size={18} color={colors.primary} />
          <Text style={styles.verifiedText}>{t('summaryVerified')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('summaryOverview')}</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>{t('summaryNoDetails')}</Text>
          ) : (
            rows.map((r) => (
              <View key={r.label} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{r.label}</Text>
                <Text style={styles.dataValue} numberOfLines={2}>{r.value}</Text>
              </View>
            ))
          )}
        </View>

        <GradientButton style={styles.primaryButton} onPress={goToDetails} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>{t('summaryViewProductDetails')}</Text>
        </GradientButton>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Scanner')} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>{t('summaryScanAgain')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <VideoPlayerModal
        visible={!!playingVideoId}
        videoId={playingVideoId || ''}
        onClose={() => setPlayingVideoId(null)}
      />
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { paddingBottom: spacing.xxxl },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  verifiedText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow(1),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  emptyText: { fontSize: 13, color: colors.muted },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  dataLabel: { fontSize: 13, color: colors.muted, flexShrink: 0 },
  dataValue: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  primaryButton: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.accent,
    ...shadow(1),
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
