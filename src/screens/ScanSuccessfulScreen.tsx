import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface ScanSuccessfulScreenProps {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

export default function ScanSuccessfulScreen({
  navigation,
  route,
  user,
  onLogout,
}: ScanSuccessfulScreenProps) {
  const { t } = useI18n();
  const productData = route?.params?.productData;
  const securityPassed = !!route?.params?.securityPassed;
  const productId = route?.params?.productId ?? productData?._id;
  const qrcodeId = route?.params?.qrcodeId ?? productData?.token_id;
  const hasIds = productId != null && qrcodeId != null;
  const { width, height } = useWindowDimensions();

  const timerRef = useRef<any>(null);
  const navigatedRef = useRef(false);

  const goToProductDetail = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigation.replace('Result', {
      securityPassed,
      ...(hasIds ? {} : { productData }),
      ...(productId != null ? { productId: String(productId) } : {}),
      ...(qrcodeId != null ? { qrcodeId: String(qrcodeId) } : {}),
    });
  };

  // Auto-advance to the product detail page after 3 seconds, unless the user
  // taps "Private Policy" first (which cancels the timer below).
  useEffect(() => {
    timerRef.current = setTimeout(goToProductDetail, 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPrivatePolicy = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    navigatedRef.current = true; // cancel the automatic redirect
    navigation.navigate('PrivatePolicy', {
      productData,
      securityPassed,
      productId,
      qrcodeId,
    });
  };

  const horizontalPadding = 16; // 8 left + 8 right
  const topBottomPadding = 20; // top + bottom content paddings in this screen
  const buttonArea = 52; // approximate button row height
  const topBarHeight = 70;
  const bottomBarHeight = 70;
  const contentWidth = Math.max(120, width - horizontalPadding);
  const availableImageHeight = Math.max(
    160,
    height - topBarHeight - bottomBarHeight - topBottomPadding - buttonArea
  );
  const naturalImageHeight = (contentWidth * 590) / 304;
  const imageHeight = Math.min(naturalImageHeight, availableImageHeight);

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={true}
      onBackPress={() => navigation.goBack()}
    >
      <View style={styles.container}>
        <Image
          source={require('../assets/success.png')}
          style={[styles.successImage, { width: contentWidth, height: imageHeight }]}
          resizeMode="contain"
        />

        <TouchableOpacity
          style={styles.privacyButton}
          onPress={openPrivatePolicy}
          activeOpacity={0.8}
        >
          <Text style={styles.privacyText}>{t('privatePolicy')}</Text>
        </TouchableOpacity>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successImage: {
    maxWidth: '100%',
  },
  privacyButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...shadow(1),
  },
  privacyText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
