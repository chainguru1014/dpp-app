import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import GradientButton from '../components/GradientButton';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
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

const fileUrl = (f: string) => {
  if (!f) return '';
  if (/^https?:\/\//i.test(f)) return f;
  return `${API_BASE_URL}files/${String(f).replace(/^\/+/, '')}`;
};

// Registration date from the Mongo ObjectId (first 4 bytes = unix seconds).
const registeredDate = (id?: string, createdAt?: string): Date | null => {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (id && /^[a-f0-9]{8}/i.test(id)) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000);
  }
  return null;
};

const fmt = (d: Date | null) => (d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

export default function ProductSummaryScreen({ navigation, route, user, onLogout }: ProductSummaryScreenProps) {
  const { t } = useI18n();
  const product = route?.params?.product || {};
  const owned = !!route?.params?.owned;

  const images = Array.isArray(product?.images) ? product.images : [];
  const videos = Array.isArray(product?.videos) ? product.videos : [];
  const hasMedia = images.length > 0 || videos.length > 0;
  const addedDate = registeredDate(product?._id, product?.createdAt);
  const validYears = Number(product?.warrantyValidYears) || 0;
  const validUntil = addedDate && validYears
    ? new Date(addedDate.getFullYear() + validYears, addedDate.getMonth(), addedDate.getDate())
    : null;
  const serial = product?.skuStyleNumber || (product?.token_id != null ? String(product.token_id) : '');

  const facts = product?.detailFacts || {};
  const rows: { label: string; value: string }[] = [
    { label: t('summaryBrand'), value: product?.brandInfo?.name || '' },
    { label: t('summaryCategory'), value: CATEGORY_LABEL[product?.itemCategory] || '' },
    { label: t('factProductType'), value: product?.productType || '' },
    { label: t('summarySerialNumber'), value: serial },
    { label: t('factColor'), value: product?.color || '' },
    { label: t('factSize'), value: product?.size || '' },
    { label: t('summaryMaterial'), value: facts.material || '' },
    { label: t('lifecycleFit'), value: facts.fit || '' },
    { label: t('lifecycleWash'), value: facts.wash || '' },
    { label: t('lifecycleDurability'), value: facts.durability || '' },
    { label: t('factManufactureDate'), value: product?.manufactureDate || '' },
    { label: t('summaryDateAdded'), value: fmt(addedDate) },
    { label: t('summaryWarrantyStatus'), value: product?.warrantyStatus || '' },
    { label: t('summaryValidUntil'), value: fmt(validUntil) },
  ].filter((r) => !!r.value);

  const goToDetails = () =>
    navigation.navigate('Result', {
      productData: product,
      productId: product?._id,
      qrcodeId: product?.token_id != null ? String(product.token_id) : undefined,
      owned,
    });

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton title={t('titleProductSummary')}>
      <View style={styles.screen}>
        <View style={styles.headerCard}>
          <View style={styles.headerMedia}>
            {hasMedia ? (
              <MediaSlider images={images} videos={videos} hideHeader flush maxHeight={148} getFileUrl={fileUrl} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Icon name="inventory-2" size={28} color={colors.placeholder} />
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={2}>{product?.name || '—'}</Text>
            <View style={styles.verifiedRow}>
              <Icon name="verified" size={15} color={colors.primary} />
              <Text style={styles.verifiedText}>{t('summaryVerified')}</Text>
            </View>
            <Text style={styles.metaLine} numberOfLines={1}>
              {[product?.brandInfo?.name, serial ? `S/N: ${serial}` : ''].filter(Boolean).join('  •  ')}
            </Text>
            {owned && !!addedDate && (
              <Text style={styles.metaLine} numberOfLines={1}>{t('summaryOwnedSince')} {fmt(addedDate)}</Text>
            )}
          </View>
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

        <View style={styles.footer}>
          <GradientButton style={styles.primaryButton} onPress={goToDetails} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{t('summaryViewProductDetails')}</Text>
          </GradientButton>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Scanner')} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>{t('summaryScanAgain')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow(1),
  },
  headerMedia: { width: 140 },
  headerInfo: { flex: 1 },
  thumb: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '700', color: colors.heading },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  verifiedText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  metaLine: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow(1),
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.muted },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  dataLabel: { fontSize: 14, color: colors.muted, flexShrink: 0, lineHeight: 19 },
  dataValue: { fontSize: 14, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right', lineHeight: 19 },
  footer: { marginTop: 'auto', paddingTop: spacing.md },
  primaryButton: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.accent,
    ...shadow(1),
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
