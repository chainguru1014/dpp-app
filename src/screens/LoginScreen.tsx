import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

const screenHeight = Dimensions.get('window').height;
import AsyncStorage from '@react-native-async-storage/async-storage';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AppleAuthButton from '../components/AppleAuthButton';
import OtpSignIn from '../components/OtpSignIn';
import AudienceToggle from '../components/AudienceToggle';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

type AuthResult = { user: any; token: string; profileCompleted: boolean };

export default function LoginScreen({ navigation, onLogin, route }: any) {
  const { t } = useI18n();
  const [apiError, setApiError] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const goAfterAuth = () => {
    const redirectTo = route?.params?.redirectTo;
    const redirectParams = route?.params?.redirectParams;
    if (redirectTo) {
      navigation.replace(redirectTo, redirectParams || {});
      return;
    }
    navigation.replace('Home');
  };

  // Tag the session with which kind of account this is so ownership-transfer
  // confirmation can identify the acting party (User vs Company/brand).
  // All three passwordless methods (Google/Apple/OTP) are User-only —
  // there is no Company/brand equivalent for any of them.
  const finalizeLogin = async (userData: any, token: string) => {
    const tagged = { ...userData, actorKind: 'User' };
    await AsyncStorage.setItem('userToken', token || '');
    await AsyncStorage.setItem('user', JSON.stringify(tagged));
    if (onLogin) {
      onLogin(tagged);
    }
    goAfterAuth();
  };

  // Shared handler for all three passwordless methods. If the backend says
  // the profile isn't complete yet (new account, or an existing account
  // that never finished onboarding), stash the token/partial user and route
  // to the profile-completion screen (the repurposed RegisterScreen)
  // instead of Home.
  const handleAuthSuccess = async ({ user, token, profileCompleted }: AuthResult) => {
    setApiError('');
    if (!profileCompleted) {
      const tagged = { ...user, actorKind: 'User' };
      await AsyncStorage.setItem('userToken', token || '');
      await AsyncStorage.setItem('user', JSON.stringify(tagged));
      navigation.replace('Register', {
        profileCompletion: true,
        partialUser: tagged,
        token,
        redirectTo: route?.params?.redirectTo,
        redirectParams: route?.params?.redirectParams,
      });
      return;
    }
    await finalizeLogin(user, token);
  };

  const handleAuthError = (message: string) => {
    setApiError(message);
  };

  return (
    <View style={styles.container}>
      {/* Background: image covers top 55%, plain colour fills the rest */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ImageBackground
          source={require('../assets/bg-login.jpg')}
          style={styles.bgImage}
          resizeMode="cover"
        >
          <View style={styles.bgOverlay} />
        </ImageBackground>
        <View style={styles.bgBottom} />
      </View>

      {/* Title floated at the top over the image */}
      <Text style={styles.pageTitle}>Digital Product Passport</Text>

      {/* KAV fills the full screen so the card centres against the whole page */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.kav}
      >
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/yometel-logo-trans.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <AudienceToggle
              value="consumer"
              onSelectConsumer={() => {}}
              onSelectStaff={() => navigation.navigate('StaffLogin')}
            />

            {!!apiError && (
              <View style={styles.apiErrorBox}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            )}

            <OtpSignIn onSuccess={handleAuthSuccess} onError={handleAuthError} mode={authMode} />

            <Text style={styles.subtitle}>Sign in to continue</Text>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleAuthButton onSuccess={handleAuthSuccess} onError={handleAuthError} navigation={navigation} />

            <AppleAuthButton onSuccess={handleAuthSuccess} onError={handleAuthError} />

            <View style={styles.modeTrack}>
              <TouchableOpacity
                style={[styles.modeOption, authMode === 'signin' && styles.modeOptionActive]}
                onPress={() => setAuthMode('signin')}
              >
                <Text style={[styles.modeOptionText, authMode === 'signin' && styles.modeOptionTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeOption, authMode === 'signup' && styles.modeOptionActive]}
                onPress={() => setAuthMode('signup')}
              >
                <Text style={[styles.modeOptionText, authMode === 'signup' && styles.modeOptionTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const webFill = Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {};
const bgImageHeight: any = Platform.OS === 'web' ? '55vh' : screenHeight * 0.55;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8ecf0',
    ...webFill,
  },
  bgImage: {
    height: bgImageHeight,
  },
  bgOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  bgBottom: {
    flex: 1,
    backgroundColor: '#e8ecf0',
  },
  kav: {
    ...StyleSheet.absoluteFillObject,
  },
  pageTitle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.xl,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 10,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    width: '100%',
  },
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    width: '100%',
    maxWidth: 380,
    ...shadow(3),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 160,
    height: 48,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '400',
    color: colors.heading,
    marginBottom: spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 13,
    marginHorizontal: spacing.md,
  },
  apiErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  apiErrorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'left',
  },
  modeTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radius.pill,
    padding: 4,
    marginTop: spacing.lg,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  modeOptionActive: {
    backgroundColor: colors.white,
    ...shadow(1),
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.muted,
  },
  modeOptionTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
});
