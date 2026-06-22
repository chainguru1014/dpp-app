import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';

const { width } = Dimensions.get('window');

const NAVY = '#2f80c8';
const PRIMARY = '#2f80c8';
const ACCENT = '#1976d2';
const LIGHT_BG = '#f4f7fc';

interface ShopNowScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

export default function ShopNowScreen({ navigation, user, onLogout }: ShopNowScreenProps) {
  const { t } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const availableContentMinHeight = Math.max(0, windowHeight - 70 - 70);

  const previewFeatures = [
    { icon: require('../assets/shield.png'), label: t('homeFeatureAuthentic') },
    { icon: require('../assets/insurance.png'), label: t('homeFeatureTraceable') },
    { icon: require('../assets/world.png'), label: t('homeFeatureSustainable') },
  ];

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      useCenterTop={false}
    >
      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && { minHeight: availableContentMinHeight }]}
        contentContainerStyle={[
          styles.content,
          Platform.OS === 'web' && { minHeight: availableContentMinHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Download intro — no card, straight on the page background */}
        <View style={styles.topContent}>
          <Text style={styles.title}>
            {t('shopTitle')}{' '}
            <Text style={styles.titleFree}>({t('shopFree')})</Text>
          </Text>
          <Text style={styles.headline}>{t('shopHeadline')}</Text>

          {/* Mobile preview of the real first-page (home) UI */}
          <View style={styles.phoneFrame}>
            <View style={styles.previewTopBar}>
              <Image
                source={require('../assets/logo-shield.png')}
                style={styles.previewLogo}
                resizeMode="contain"
              />
              <Text style={styles.previewTopBarText} numberOfLines={1}>
                {t('homeHeroEyebrow')}
              </Text>
              <View style={styles.previewGlobe}>
                <Image
                  source={require('../assets/world.png')}
                  style={styles.previewGlobeIcon}
                  resizeMode="contain"
                />
              </View>
            </View>

            <View style={styles.previewBody}>
              <View style={styles.previewQrCard}>
                <View style={styles.previewQrFrame}>
                  <Image
                    source={require('../assets/qr-secure.png')}
                    style={styles.previewQr}
                    resizeMode="contain"
                  />
                  <View style={[styles.previewBracket, styles.pBracketTL]} />
                  <View style={[styles.previewBracket, styles.pBracketTR]} />
                  <View style={[styles.previewBracket, styles.pBracketBL]} />
                  <View style={[styles.previewBracket, styles.pBracketBR]} />
                </View>

                <Text style={styles.previewScanTitle}>{t('homeScanQr')}</Text>
                <Text style={styles.previewScanHint} numberOfLines={1}>
                  {t('homeScanHint')}
                </Text>

                <View style={styles.previewFeatureRow}>
                  {previewFeatures.map((f, i) => (
                    <View key={i} style={styles.previewFeatureItem}>
                      <View style={styles.previewFeatureIconWrap}>
                        <Image
                          source={f.icon}
                          style={styles.previewFeatureIcon}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.previewFeatureLabel}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.previewDots}>
                <View style={[styles.previewDot, styles.previewDotActive]} />
                <View style={styles.previewDot} />
                <View style={styles.previewDot} />
                <View style={styles.previewDot} />
              </View>
            </View>
          </View>

          <Text style={styles.body}>{t('shopBody')}</Text>
        </View>

        {/* Wordmark + store badges — moved here from the home page. */}
        <View style={styles.appPromoSection}>
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <Text style={styles.wordmark}>
                <Text style={styles.wordmarkBrand}>Yometel</Text>
                <Text style={styles.wordmarkDpp}> DPP</Text>
              </Text>
            </View>

            <View style={styles.footerRight}>
              <Image
                source={require('../assets/appstore-badge.png')}
                style={styles.promoBadge}
                resizeMode="contain"
              />
              <Image
                source={require('../assets/googleplay-badge.png')}
                style={styles.promoBadge}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },
  topContent: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  title: {
    color: NAVY,
    fontSize: 24,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 30,
  },
  titleFree: {
    color: ACCENT,
    fontWeight: '400',
  },
  headline: {
    color: '#5a6b86',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },

  // Mobile preview of the real first-page UI
  phoneFrame: {
    width: Math.min(width * 0.68, 256),
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dbe2ee',
    marginVertical: 26,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 7,
  },
  previewTopBar: {
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  previewLogo: {
    width: 20,
    height: 20,
  },
  previewTopBarText: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 7.5,
    fontWeight: '400',
    letterSpacing: 0.4,
    marginHorizontal: 4,
  },
  previewGlobe: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlobeIcon: {
    width: 10,
    height: 10,
    tintColor: '#fff',
  },
  previewBody: {
    backgroundColor: LIGHT_BG,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  previewQrCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7edf6',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  previewQrFrame: {
    width: 84,
    height: 84,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewQr: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  previewBracket: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: PRIMARY,
    borderWidth: 2,
  },
  pBracketTL: { top: -3, left: -3, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 3 },
  pBracketTR: { top: -3, right: -3, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 3 },
  pBracketBL: { bottom: -3, left: -3, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 3 },
  pBracketBR: { bottom: -3, right: -3, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 3 },
  previewScanTitle: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '400',
    color: PRIMARY,
  },
  previewScanHint: {
    marginTop: 3,
    fontSize: 7,
    color: '#7a8aa3',
    textAlign: 'center',
  },
  previewFeatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    marginTop: 10,
  },
  previewFeatureItem: {
    alignItems: 'center',
    flex: 1,
  },
  previewFeatureIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LIGHT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  previewFeatureIcon: {
    width: 12,
    height: 12,
    tintColor: PRIMARY,
  },
  previewFeatureLabel: {
    fontSize: 7,
    fontWeight: '400',
    color: PRIMARY,
  },
  previewDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  previewDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#c7d2e4',
    marginHorizontal: 2,
  },
  previewDotActive: {
    width: 12,
    backgroundColor: ACCENT,
  },

  body: {
    color: '#6b7a93',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
  },
  // Wordmark + stacked store badges (moved from the home page).
  appPromoSection: {
    marginTop: 24,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: '#e7edf6',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 3,
    paddingRight: 8,
  },
  wordmark: {
    textAlign: 'center',
  },
  wordmarkBrand: {
    color: '#2f4c95',
    fontSize: 27,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  wordmarkDpp: {
    color: '#8a97ad',
    fontSize: 25,
    fontWeight: '400',
  },
  footerRight: {
    flex: 2,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 10,
  },
  promoBadge: {
    width: 150,
    height: 46,
  },
});
