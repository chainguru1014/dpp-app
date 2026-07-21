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
  TouchableOpacity,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AppleAuthButton from '../components/AppleAuthButton';
import OtpSignIn from '../components/OtpSignIn';
import { colors, spacing, radius, shadow } from '../theme';

type AuthResult = { user: any; token: string; profileCompleted: boolean; mode?: 'signin' | 'signup' };

export default function LoginScreen({ navigation, onLogin, route }: any) {
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
    // First login ever (or any older account that predates this feature and
    // never decided) — gate on the AI Concierge personalization consent
    // screen before Home, same pattern as the profile-completion gate above.
    // See AiConciergeConsentScreen.
    if (!tagged.aiConciergeConsentAt) {
      navigation.replace('AiConciergeConsent', {
        partialUser: tagged,
        token,
        redirectTo: route?.params?.redirectTo,
        redirectParams: route?.params?.redirectParams,
      });
      return;
    }
    goAfterAuth();
  };

  // Shared handler for all three passwordless methods. If the backend says
  // the profile isn't complete yet (new account, or an existing account
  // that never finished onboarding), stash the token/partial user and route
  // to the profile-completion screen (the repurposed RegisterScreen)
  // instead of Home. Exception: OTP sign-in (mode === 'signin') never
  // requires profile completion — auth/otp/request only succeeds for an
  // email that's already registered, so an incomplete profile there means an
  // old abandoned signup, not someone who needs onboarding right now.
  // Google/Apple and OTP signup are unaffected and keep the redirect.
  const handleAuthSuccess = async ({ user, token, profileCompleted, mode }: AuthResult) => {
    setApiError('');
    if (!profileCompleted && mode !== 'signin') {
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
      {/* Background image covers the full page (was just the top 55%, with a
          plain colour fill below it) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ImageBackground
          source={require('../assets/bg-login.jpg')}
          style={styles.bgImage}
          resizeMode="cover"
        >
          <View style={styles.bgOverlay} />
        </ImageBackground>
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

            {!!apiError && (
              <View style={styles.apiErrorBox}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            )}

            <OtpSignIn onSuccess={handleAuthSuccess} onError={handleAuthError} mode={authMode} />

            <View style={styles.socialRow}>
              <GoogleAuthButton onSuccess={handleAuthSuccess} onError={handleAuthError} navigation={navigation} />
              <AppleAuthButton onSuccess={handleAuthSuccess} onError={handleAuthError} />
            </View>

            <TouchableOpacity
              style={styles.authModeLink}
              onPress={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
            >
              <Text style={styles.authModeLinkText}>
                {authMode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>

            {/* GDPR: lets a user reopen the AI Concierge consent screen at any
                time to review or change their choice — see AiConciergeConsentScreen,
                which resolves the current user from AsyncStorage when reached
                with no params like this. */}
            <TouchableOpacity
              style={styles.privacyLink}
              onPress={() => navigation.navigate('AiConciergeConsent')}
            >
              <Text style={styles.privacyLinkText}>Privacy Preferences</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const webFill = Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8ecf0',
    ...webFill,
  },
  bgImage: {
    flex: 1,
  },
  bgOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  // Higher zIndex than pageTitle below — the card is opaque, so if it grows
  // tall enough to reach the title's area, it should cover the title rather
  // than the title floating on top of the card.
  kav: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
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
    maxWidth: 340,
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
  title: {
    fontSize: 24,
    fontWeight: '400',
    color: colors.heading,
    marginBottom: spacing.xl,
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
  socialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  authModeLink: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  authModeLinkText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.primary,
  },
  privacyLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  privacyLinkText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});
