import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

// First page for anyone who isn't signed in: company logo on top, the
// Digital Product Passport illustration behind, one Start button at the
// bottom. Start goes to Login, which itself decides between Signup (new on
// this device) and Login (see utils/authPrefs).
export default function IntroScreen({ navigation, route }: any) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground source={require('../assets/bg-intro-dpp.jpg')} style={styles.bg} resizeMode="cover">
      <View style={[styles.top, { paddingTop: insets.top + spacing.xxxl }]}>
        <Image
          source={require('../assets/yometel-logo-white.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Yometel"
        />
        <Text style={styles.tagline} accessibilityRole="header">{t('introTagline')}</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <TouchableOpacity
          style={styles.start}
          onPress={() => navigation.replace('Login', route?.params || {})}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('introStart')}
        >
          <Text style={styles.startText}>{t('introStart')}</Text>
          <Icon name="arrow-forward" size={30} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : null),
  },
  top: { alignItems: 'center', paddingHorizontal: spacing.xl },
  logo: { width: 220, height: 64 },
  tagline: {
    marginTop: spacing.md,
    color: colors.onDarkSoft,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bottom: { alignItems: 'center', paddingHorizontal: spacing.xxl },
  start: {
    width: '100%',
    maxWidth: 380,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadow(3),
  },
  startText: { fontSize: 26, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
});
