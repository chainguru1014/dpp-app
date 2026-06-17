import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { colors, gradients } from '../theme';

const TOP_BAR_HEIGHT = 70;
const BOTTOM_BAR_HEIGHT = 70;
const DOTS_HEIGHT = 36;
// Vertical space reserved below the slider for the shared "Discover Exceptional
// Products" card (its own height + margins).
const DARK_CARD_RESERVE = 196;

interface HomeScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

export default function HomeScreen({ navigation, user, onLogout }: HomeScreenProps) {
  const { t } = useI18n();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // QR image display size — banner slides match this height so every slide aligns.
  const qrSize = Math.min(windowWidth * 0.52, 230);

  // This app's #root is a display:block 100vh div, so the flex:1 height chain does
  // NOT propagate — a flex:1 child collapses to its content height on react-native-web.
  // We therefore floor the screen with an explicit minHeight AND measure the real
  // available area via onLayout, then drive the slide height from that pixel value.
  const fallbackHeight = Math.max(0, windowHeight - TOP_BAR_HEIGHT - BOTTOM_BAR_HEIGHT);
  const [areaHeight, setAreaHeight] = useState(0);
  const usableHeight = areaHeight || fallbackHeight;
  // Every slide is the same fixed height; the shared dark card sits below the slider.
  const cardHeight = Math.max(360, usableHeight - DOTS_HEIGHT - DARK_CARD_RESERVE);

  const [pageWidth, setPageWidth] = useState(windowWidth);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScanPress = () => navigation.navigate('Scanner');
  const handleShopNow = () => navigation.navigate('ShopNow');

  const onScreenLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h && Math.abs(h - areaHeight) > 1) setAreaHeight(h);
  };

  const onPagerLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width && width !== pageWidth) setPageWidth(width);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (i !== active && i >= 0 && i < slideCount) setActive(i);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
    setActive(i);
  };

  const features = [
    { icon: require('../assets/shield.png'), label: t('homeFeatureAuthentic') },
    { icon: require('../assets/insurance.png'), label: t('homeFeatureTraceable') },
    { icon: require('../assets/world.png'), label: t('homeFeatureSustainable') },
  ];

  // Banner slides (samples #1 / #2 / #3) — reuse the soft catalog photos.
  const banners = [
    { key: 'spring', img: require('../assets/slider_1.png'), caption: t('homeBannerSpring') },
    { key: 'spirits', img: require('../assets/slider_2.png'), caption: t('homeBannerSpirits') },
    { key: 'sports', img: require('../assets/slider_3.png'), caption: t('homeBannerSports') },
  ];

  const slideCount = 1 + banners.length;

  // "Why install Yometel DPP?" content — now merged into the bottom of each banner card.
  const renderWhyContent = () => (
    <View style={styles.whyBlock}>
      <Text style={styles.whyTitle}>{t('homeWhyTitle')}</Text>
      {[t('homeWhyBullet1'), t('homeWhyBullet2')].map((line, i) => (
        <View key={i} style={styles.whyRow}>
          <View style={styles.whyCheck}>
            <Text style={styles.whyCheckMark}>✓</Text>
          </View>
          <Text style={styles.whyText}>{line}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={false}
      useCenterTop={false}
    >
      <View style={[styles.screen, { minHeight: fallbackHeight }]} onLayout={onScreenLayout}>
        {/* Slider — only the "image section" of each slide (equal heights) */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onLayout={onPagerLayout}
          style={[styles.pager, { height: cardHeight }]}
        >
          {/* Slide 1 — QR scan card */}
          <View style={{ width: pageWidth, height: cardHeight }}>
            <ScrollView
              style={{ height: cardHeight }}
              contentContainerStyle={styles.slideContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.card, styles.scanCard]}>
                <TouchableOpacity
                  style={styles.qrContainer}
                  onPress={handleScanPress}
                  activeOpacity={0.85}
                >
                  <View style={[styles.qrFrame, { width: qrSize }]}>
                    <Image
                      source={require('../assets/qr-secure.png')}
                      style={styles.mainQrImage}
                      resizeMode="contain"
                    />
                    <View style={[styles.cornerBracket, styles.topLeft]} />
                    <View style={[styles.cornerBracket, styles.topRight]} />
                    <View style={[styles.cornerBracket, styles.bottomLeft]} />
                    <View style={[styles.cornerBracket, styles.bottomRight]} />
                  </View>
                </TouchableOpacity>

                <Text style={styles.scanTitle}>{t('homeScanQr')}</Text>
                <Text style={styles.scanHint}>{t('homeScanHint')}</Text>

                <View style={styles.featureRow}>
                  {features.map((f, i) => (
                    <View key={i} style={styles.featureItem}>
                      <View style={styles.featureIconWrap}>
                        <Image source={f.icon} style={styles.featureIcon} resizeMode="contain" />
                      </View>
                      <Text style={styles.featureLabel}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Slides 2-4 — banner image + Shop Now + "Why install" at the bottom */}
          {banners.map((b) => (
            <View key={b.key} style={{ width: pageWidth, height: cardHeight }}>
              <ScrollView
                style={{ height: cardHeight }}
                contentContainerStyle={styles.slideContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.card, styles.bannerCard]}>
                  <Image
                    source={b.img}
                    style={[styles.bannerImage, { height: qrSize }]}
                    resizeMode="cover"
                  />
                  <View style={styles.bannerBody}>
                    <Text style={styles.bannerCaption}>{b.caption}</Text>
                    <TouchableOpacity
                      style={styles.shopButton}
                      onPress={handleShopNow}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.shopButtonText}>{t('homeShopNow')}</Text>
                    </TouchableOpacity>
                  </View>

                  {renderWhyContent()}
                </View>
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        {/* Pagination dots */}
        <View style={styles.dots}>
          {Array.from({ length: slideCount }).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <View style={[styles.dot, active === i && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Shared dark passport card (sample #5) — out of the slider */}
        <View style={[styles.darkCard, gradients.hero]}>
          <Text style={styles.darkEyebrow}>{t('homeHeroEyebrow')}</Text>
          <Text style={styles.darkTitle}>{t('homeHeroTitle')}</Text>
          <Text style={styles.darkSubtitle}>{t('homeHeroSubtitle')}</Text>
        </View>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pager: {
    width: '100%',
  },
  slideContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  // Shared white card base for every slide (slide 1 + banners look the same).
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },

  // Slide 1 — QR scan card
  scanCard: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFrame: {
    maxWidth: 230,
    aspectRatio: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainQrImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.accent,
    borderWidth: 3,
  },
  topLeft: {
    borderColor: colors.primary,
    top: -6,
    left: -6,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  topRight: {
    borderColor: colors.primary,
    top: -6,
    right: -6,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    borderColor: colors.primary,
    bottom: -6,
    left: -6,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    borderColor: colors.primary,
    bottom: -6,
    right: -6,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  scanTitle: {
    marginTop: 22,
    fontSize: 22,
    fontWeight: '400',
    color: colors.primary,
    textAlign: 'center',
  },
  scanHint: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 22,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    width: 24,
    height: 24,
    tintColor: colors.primary,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.primary,
  },

  // Slides 2-4 — banner card
  bannerCard: {
    // image sits flush at the top; body + why content below
  },
  bannerImage: {
    width: '100%',
  },
  bannerBody: {
    paddingTop: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bannerCaption: {
    fontSize: 21,
    fontWeight: '400',
    color: '#33415c',
    textAlign: 'center',
    lineHeight: 27,
    marginBottom: 14,
  },
  shopButton: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shopButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.3,
  },

  // "Why install" content pinned to the bottom of the banner card
  whyBlock: {
    marginTop: 'auto',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  whyTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.navy,
    marginBottom: 12,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 9,
  },
  whyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e7f0fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  whyCheckMark: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '400',
  },
  whyText: {
    flex: 1,
    fontSize: 13,
    color: '#33415c',
    lineHeight: 19,
  },

  // Pagination dots
  dots: {
    height: DOTS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#c7d2e4',
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.accent,
  },

  // Shared dark passport card — out of the slider, below the dots
  darkCard: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 22,
    backgroundColor: colors.primary,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  darkEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  darkTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 31,
    marginBottom: 8,
  },
  darkSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
});
