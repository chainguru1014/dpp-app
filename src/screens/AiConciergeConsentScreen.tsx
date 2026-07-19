import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { colors, spacing, radius, shadow } from '../theme';

// Shown once after a User's first login — LoginScreen.finalizeLogin and
// RegisterScreen.handleCompleteProfile both route here whenever
// `aiConciergeConsentAt` is still unset on the account — and reachable any
// time after via the "Privacy Preferences" link on LoginScreen, so a user
// can change or withdraw consent per GDPR.
//
// The user record to act on is resolved from whichever source is available:
// route params first (passed by the login/profile-completion gate, which
// already has the freshly-authenticated user + token in hand), falling back
// to AsyncStorage (covers a bare app relaunch that lands here directly, and
// the Privacy Preferences link, which has neither).
//
// Three derived modes:
//  - 'onboarding': no decision recorded yet — submitting always proceeds
//    into the app (Home or the original redirect target).
//  - 'review': already decided once, revisiting via Privacy Preferences —
//    submitting just returns to where they came from.
//  - 'preview': nobody is signed in (Privacy Preferences tapped from a
//    signed-out Login screen) — informational only, nothing is persisted,
//    since there's no account to attach a decision to yet.
// `null` = no explicit choice made yet, which is what keeps the primary
// button disabled below. Only a user who already has a recorded decision
// (aiConciergeConsentAt set) starts pre-selected; a fresh onboarding/preview
// visit always requires an active choice.
const initialConsentFor = (user: any): boolean | null => (user?.aiConciergeConsentAt ? !!user.aiConciergeConsent : null);

export default function AiConciergeConsentScreen({ navigation, route, onLogin }: any) {
  const [sourceUser, setSourceUser] = useState<any>(route?.params?.partialUser ?? undefined);
  const [token, setToken] = useState<string>(route?.params?.token || '');
  const [resolved, setResolved] = useState(!!route?.params?.partialUser);
  const [consent, setConsent] = useState<boolean | null>(initialConsentFor(route?.params?.partialUser));
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (resolved) return;
    (async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('userToken'),
        ]);
        const parsed = storedUser && storedUser !== 'null' && storedUser !== 'undefined' ? JSON.parse(storedUser) : null;
        if (parsed) {
          setSourceUser(parsed);
          setConsent(initialConsentFor(parsed));
        }
        setToken(storedToken || '');
      } catch (err) {
        console.error('Failed to load stored user for the consent screen:', err);
      } finally {
        setResolved(true);
      }
    })();
  }, [resolved]);

  const mode: 'onboarding' | 'review' | 'preview' = !sourceUser
    ? 'preview'
    : !sourceUser.aiConciergeConsentAt
    ? 'onboarding'
    : 'review';

  const redirectTo = route?.params?.redirectTo;
  const redirectParams = route?.params?.redirectParams;

  const handleSubmit = async () => {
    if (mode === 'preview') {
      navigation.goBack();
      return;
    }
    if (consent === null) return;
    setApiError('');
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}auth/ai-concierge-consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ consent }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== 'success') {
        throw new Error(data?.message || 'Could not save your preference. Please try again.');
      }
      const updatedUser = { ...sourceUser, ...(data.user || {}), actorKind: 'User' };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      onLogin?.(updatedUser);
      if (mode === 'onboarding') {
        if (redirectTo) navigation.replace(redirectTo, redirectParams || {});
        else navigation.replace('Home');
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      setApiError(err?.message || 'Network error, please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!resolved) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Same full-page background treatment as LoginScreen (was previously
          just the top 55%, with a plain colour fill below it). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ImageBackground source={require('../assets/bg-login.jpg')} style={styles.imageBg} resizeMode="cover">
          <View style={styles.bgOverlay} />
        </ImageBackground>
      </View>
      <Text style={styles.pageTitle}>Digital Product Passport</Text>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.centeredOverlay}>
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator
            >
              <Image
                source={require('../assets/yometel-logo-trans.png')}
                style={{ width: 140, height: 42, marginBottom: spacing.lg, alignSelf: 'center' }}
                resizeMode="contain"
              />

              <Text style={styles.welcome}>Welcome</Text>
              <Text style={styles.title}>Meet Your AI Concierge</Text>
              <Text style={styles.paragraph}>Discover products you'll love.</Text>

              <Text style={styles.sectionTitle}>Scan the products you love.</Text>
              <Text style={styles.paragraph}>
                Your AI Concierge learns your preferences and recommends products you'll love—across brands.
              </Text>
              <Text style={styles.paragraph}>
                Your preferences and scan history may also be shared with participating brands and retailers
                to deliver more relevant recommendations and help improve products and services.
              </Text>
              <Text style={styles.paragraph}>
                Your profile cannot be used to identify you personally. Your scans and preferences are linked
                only to your in-app profile—not to your real identity.
              </Text>

              {/* Placed after all the explanatory content, on purpose — the
                  user should read what they're agreeing to before choosing.
                  Nothing is pre-selected for a fresh visit, and the primary
                  button below stays disabled until one of these is picked. */}
              <Text style={styles.consentLabel}>
                I agree to let the AI Concierge of this app learn from my scans, favorites, and browsing
                history to personalize my experience.
              </Text>
              <View style={styles.consentButtonRow}>
                <TouchableOpacity
                  style={[styles.consentButton, consent === true && styles.consentButtonAgreeActive]}
                  onPress={() => setConsent(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.consentButtonText, consent === true && styles.consentButtonTextActive]}>
                    I Agree
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.consentButton, consent === false && styles.consentButtonDisagreeActive]}
                  onPress={() => setConsent(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.consentButtonText, consent === false && styles.consentButtonTextActive]}>
                    I Disagree
                  </Text>
                </TouchableOpacity>
              </View>

              {mode === 'preview' && (
                <Text style={styles.previewNote}>Sign in to save this preference to your account.</Text>
              )}

              {!!apiError && (
                <View style={styles.apiErrorBox}>
                  <Text style={styles.apiErrorText}>{apiError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.button, (saving || consent === null) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={saving || consent === null}
              >
                <Text style={styles.buttonText}>
                  {saving
                    ? 'Saving…'
                    : mode === 'onboarding'
                    ? 'Continue'
                    : mode === 'review'
                    ? 'Save Preferences'
                    : 'Close'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const screenHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  imageBg: { flex: 1 },
  bgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  centeredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 10,
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, width: '100%' },
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: radius.xl,
    width: '100%',
    // Wider than the sign-in/sign-up card so the longer explanatory text
    // wraps into fewer lines and fits without needing to scroll — but not
    // so wide that it overflows a phone-width viewport.
    maxWidth: 400,
    // Taller cap too (was 0.72, then 0.85) — combined with the extra width,
    // this keeps the full-length copy visible without scrolling on most
    // devices; any overflow past this still scrolls (see cardScroll's
    // `flex: 1` below) rather than getting clipped, as a fallback for
    // smaller screens.
    maxHeight: Math.round(screenHeight * 0.94),
    overflow: 'hidden',
    ...shadow(3),
  },
  // `flex: 1` (not just flexShrink) is what actually bounds the ScrollView to
  // the card's maxHeight on iOS — without it the content can render past the
  // card and get silently clipped by `overflow: 'hidden'` above instead of
  // scrolling.
  cardScroll: { width: '100%', flex: 1 },
  cardScrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.md },
  cardFooter: {
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,30,60,0.08)',
  },
  welcome: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '400',
    color: colors.heading,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.heading,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  consentLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  consentButtonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  consentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  consentButtonAgreeActive: {
    // Deliberately a brighter green than the shared `colors.success` token
    // (which is a muted forest green used for status text elsewhere) — this
    // button should read as vividly "agreed", not just a generic success state.
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  consentButtonDisagreeActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  consentButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
  },
  consentButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  previewNote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.muted,
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow(1),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '400' },
  apiErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  apiErrorText: { color: colors.danger, fontSize: 13, textAlign: 'left' },
});
