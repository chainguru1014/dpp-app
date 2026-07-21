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
import { getStoredAiConciergeConsent, setStoredAiConciergeConsent } from '../utils/aiConciergeConsent';

// The pre-login consent gate — AppNavigator's initialRouteName sends every
// fresh app instance here first until a local choice exists (see
// aiConciergeConsent.ts), regardless of whether anyone is signed in yet.
// Also reachable any time after via the "Privacy Preferences" link on
// LoginScreen (passing `reviewMode: true`), so a user can change or
// withdraw their choice per GDPR.
//
// The choice itself is device-local, not account-bound — deciding happens
// before login, so there's no account yet to attach it to. If a session
// happens to exist (review mode, already signed in), submitting also
// best-effort syncs to the backend so the account record stays current;
// that sync is never allowed to block navigation (see handleSubmit).
//
// Two modes:
//  - 'gate': the pre-login initial visit — submitting always continues to
//    Login next.
//  - 'review': revisiting via Privacy Preferences — submitting returns to
//    wherever the link was opened from.
// `null` = no explicit choice made yet, which is what keeps the primary
// button disabled below. A prior local choice (either mode) starts
// pre-selected so the user sees what they picked last time.
export default function AiConciergeConsentScreen({ navigation, route, onLogin }: any) {
  const reviewMode = !!route?.params?.reviewMode;
  const [token, setToken] = useState<string>('');
  const [resolved, setResolved] = useState(false);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedChoice] = await Promise.all([
          AsyncStorage.getItem('userToken'),
          getStoredAiConciergeConsent(),
        ]);
        setToken(storedToken || '');
        if (storedChoice) setConsent(storedChoice.consent);
      } catch (err) {
        console.error('Failed to load stored AI Concierge consent state:', err);
      } finally {
        setResolved(true);
      }
    })();
  }, []);

  const mode: 'gate' | 'review' = reviewMode ? 'review' : 'gate';

  const handleSubmit = async () => {
    if (consent === null) return;
    setSaving(true);

    await setStoredAiConciergeConsent(consent);

    // Best-effort account sync: only meaningful if a session happens to
    // exist (review mode revisited while signed in) — in gate mode there is
    // no token yet, so this is skipped entirely. Never blocks navigation
    // below, same reasoning as ScannerScreen's best-effort scan/record.
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}auth/ai-concierge-consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ consent }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.status === 'success' && data.user) {
          const storedUser = await AsyncStorage.getItem('user');
          const parsed = storedUser && storedUser !== 'null' && storedUser !== 'undefined' ? JSON.parse(storedUser) : {};
          const updatedUser = { ...parsed, ...data.user, actorKind: 'User' };
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
          onLogin?.(updatedUser);
        } else if (!response.ok) {
          console.warn('Could not sync AI Concierge consent to account:', data?.message || response.status);
        }
      } catch (err: any) {
        console.warn('Could not sync AI Concierge consent to account:', err?.message || err);
      }
    }

    setSaving(false);

    if (mode === 'review') {
      navigation.goBack();
    } else {
      navigation.replace('Login');
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

            </ScrollView>

            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.button, (saving || consent === null) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={saving || consent === null}
              >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Continue'}</Text>
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
    marginBottom: spacing.lg,
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
