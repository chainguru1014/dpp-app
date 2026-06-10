import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import AppLayout from '../components/AppLayout';
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
  const productData = route?.params?.productData;
  const securityPassed = !!route?.params?.securityPassed;
  const { width, height } = useWindowDimensions();

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
          onPress={() => {
            navigation.navigate('PrivatePolicy', {
              productData,
              securityPassed,
              productId: route?.params?.productId ?? productData?._id,
              qrcodeId: route?.params?.qrcodeId ?? productData?.token_id,
            });
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.privacyText}>Private Policy</Text>
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
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
