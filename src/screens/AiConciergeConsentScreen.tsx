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
    setSaving(true);

    // Best-effort save: this is a preference, not a gate, so an auth/network
    // hiccup on the API call must never trap the user on this screen — they
    // still proceed into the app either way. Mirrors the same best-effort
    // pattern ScannerScreen uses for scan/record.
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
      if (response.ok && data.status === 'success') {
        const updatedUser = { ...sourceUser, ...(data.user || {}), actorKind: 'User' };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        onLogin?.(updatedUser);
      } else {
        console.warn('Could not save AI Concierge consent:', data?.message || response.status);
      }
    } catch (err: any) {
      console.warn('Could not save AI Concierge consent:', err?.message || err);
    } finally {
      setSaving(false);
    }

    if (mode === 'onboarding') {
      if (redirectTo) navigation.replace(redirectTo, redirectParams || {});
      else navigation.replace('Home');
    } else {
      navigation.goBack();
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
                style={{ width: 120, height: 36, marginBottom: spacing.sm, alignSelf: 'center' }}
                resizeMode="contain"
              />

              <Text style={styles.welcome}>Welcome</Text>
              <Text style={styles.title}>Meet Your AI Concierge</Text>

              <Text style={styles.sectionTitle}>Scan the products you like, discover what you like next.</Text>
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
                  <Text style={[styles.consentButtonText, consent === true && styles.consentButtonTextAgreeActive]}>
                    I Agree
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.consentButton, consent === false && styles.consentButtonDisagreeActive]}
                  onPress={() => setConsent(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.consentButtonText, consent === false && styles.consentButtonTextDisagreeActive]}>
                    I Disagree
                  </Text>
                </TouchableOpacity>
              </View>

              {mode === 'preview' && (
                <Text style={styles.previewNote}>Sign in to save this preference to your account.</Text>
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
  // Higher zIndex than pageTitle below — the card is opaque, so if it grows
  // tall enough to reach the title's area, it should cover the title rather
  // than the title floating on top of the card.
  centeredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
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
  cardScrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  cardFooter: {
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,30,60,0.08)',
  },
  // Smaller font sizes + tighter line-heights/paragraph spacing than before —
  // this content was overflowing the card (and getting clipped) on shorter
  // devices; denser typography fits it without relying on scrolling.
  welcome: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.heading,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.heading,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  consentLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  consentButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  // Height matches the frontend project's SMALL_CONTROL_HEIGHT /
  // CONSENT_BUTTON_HEIGHT (27, see AuthPage.js / AiConciergeConsentPage).
  consentButton: {
    flex: 1,
    height: 27,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  consentButtonAgreeActive: {
    // The app's dark blue (colors.primaryDark) — matches the Continue/Save
    // Preferences/Close button below and the frontend project's equivalent.
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  consentButtonDisagreeActive: {
    backgroundColor: '#e5e7eb',
    borderColor: '#e5e7eb',
  },
  consentButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text,
  },
  consentButtonTextAgreeActive: {
    color: colors.white,
    fontWeight: '600',
  },
  consentButtonTextDisagreeActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  previewNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.muted,
    marginTop: spacing.xs,
  },
  // Height matches the frontend project's CONSENT_BUTTON_HEIGHT (27, see
  // AiConciergeConsentPage). Dark blue background (colors.primaryDark) to
  // match the I Agree active state above.
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    height: 27,
    paddingVertical: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow(1),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: '400' },
});
