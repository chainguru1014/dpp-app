import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import VideoPlayerModal from '../components/VideoPlayerModal';
import GradientButton from '../components/GradientButton';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow, MIN_TOUCH } from '../theme';

interface ScanSuccessfulScreenProps {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

export default function ScanSuccessfulScreen({ navigation, route, user, onLogout }: ScanSuccessfulScreenProps) {
  const { t } = useI18n();
  const productData = route?.params?.productData || {};
  const securityPassed = !!route?.params?.securityPassed;
  const productId = route?.params?.productId ?? productData?._id;
  const qrcodeId = route?.params?.qrcodeId ?? productData?.token_id;
  const hasIds = productId != null && qrcodeId != null;
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const images = Array.isArray(productData?.images) ? productData.images : [];
  const videos = Array.isArray(productData?.videos) ? productData.videos : [];

  const goToProductDetail = () => {
    navigation.replace('Result', {
      securityPassed,
      ...(hasIds ? {} : { productData }),
      ...(productId != null ? { productId: String(productId) } : {}),
      ...(qrcodeId != null ? { qrcodeId: String(qrcodeId) } : {}),
    });
  };

  const highlights = [
    { icon: 'verified', title: t('detectedHlAuthenticated'), sub: t('detectedHlAuthenticatedSub'), color: colors.success },
    { icon: 'eco', title: t('detectedHlSustainable'), sub: t('detectedHlSustainableSub'), color: colors.success },
    { icon: 'public', title: t('detectedHlLowImpact'), sub: t('detectedHlLowImpactSub'), color: colors.primary },
  ];

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <View style={styles.screen}>
        <View style={styles.checkWrap}>
          <View style={styles.checkCircle} accessible={false}>
            <Icon name="check" size={22} color="#fff" />
          </View>
          <Text style={styles.title} accessibilityRole="header">{t('detectedTitle')}</Text>
          <Text style={styles.subtitle}>{t('detectedSubtitle')}</Text>
        </View>

        <View style={styles.card}>
          <MediaSlider
            images={images}
            videos={videos}
            hideHeader
            maxHeight={140}
            watchLabel={t('watchVideo')}
            onPlayVideo={setPlayingVideoId}
          />
          {!!productData?.name && (
            <Text style={styles.productName} numberOfLines={1}>{productData.name}</Text>
          )}
        </View>

        <View style={[styles.card, styles.highlightsCard]}>
          <Text style={styles.hlHeader}>{t('detectedQuickHighlights')}</Text>
          {highlights.map((h) => (
            <View key={h.title} style={styles.hlRow}>
              <Icon name={h.icon} size={18} color={h.color} />
              <View style={{ flex: 1 }}>
                <Text style={styles.hlTitle} numberOfLines={1}>{h.title}</Text>
                <Text style={styles.hlSub} numberOfLines={1}>{h.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <GradientButton
            style={styles.primaryButton}
            onPress={goToProductDetail}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('detectedViewProduct')}
          >
            <Text style={styles.primaryButtonText} numberOfLines={1}>{t('detectedViewProduct')}</Text>
          </GradientButton>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.replace('Scanner')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('detectedScanAnother')}
          >
            <Text style={styles.secondaryButtonText} numberOfLines={1}>{t('detectedScanAnother')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.privacyLink}
            onPress={() => navigation.navigate('PrivatePolicy', { productData, securityPassed, productId, qrcodeId })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('privatePolicy')}
          >
            <Text style={styles.linkText}>{t('privatePolicy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <VideoPlayerModal visible={!!playingVideoId} videoId={playingVideoId} onClose={() => setPlayingVideoId(null)} />
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  checkWrap: { alignItems: 'center', marginBottom: spacing.sm },
  checkCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.heading },
  subtitle: { fontSize: 19, color: colors.muted, marginTop: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  // Extra left breathing room specifically for the Quick Highlights card —
  // its icon+text rows read as cramped against the card's left edge at the
  // shared `card` style's default padding.
  highlightsCard: { paddingLeft: spacing.lg },
  productName: { fontSize: 20, fontWeight: '700', color: colors.heading, marginTop: spacing.sm, textAlign: 'center' },
  productModel: { fontSize: 17, color: colors.muted, textAlign: 'center', marginTop: 1 },
  productId: { fontSize: 17, color: colors.placeholder, textAlign: 'center', marginTop: 2 },
  hlHeader: { fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  hlRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 4 },
  hlTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  hlSub: { fontSize: 17, color: colors.muted },
  footer: { marginTop: 'auto' },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  primaryButtonText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  privacyLink: { alignSelf: 'center', minHeight: MIN_TOUCH, justifyContent: 'center', paddingVertical: spacing.sm, marginTop: spacing.md },
  secondaryButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.accent, fontSize: 19, fontWeight: '600' },
  linkText: { color: colors.accent, fontSize: 17, textDecorationLine: 'underline' },
});
