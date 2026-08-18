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
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL } from '../config/api';
import GradientButton from '../components/GradientButton';
import GradientView from '../components/GradientView';
import { colors, spacing, radius, shadow } from '../theme';

const FEATURES = [
  {
    icon: 'qr-code-2',
    title: 'Personalized just for you',
    description: "Your AI Concierge learns from your scans, favorites, and browsing habits to recommend products and brands you'll love.",
  },
  {
    icon: 'shield',
    title: 'Your privacy is our priority',
    description: 'Your real identity is never saved. Your scans and preferences are linked only to your unique profile, and to what you ask or need help.',
  },
  {
    icon: 'people',
    title: 'Smarter recommendations',
    description: "From styling trends to care tips, you'll receive relevant information about your closet and preferences to improve product recommendations and services.",
  },
  {
    icon: 'lock',
    title: "You're in control",
    description: 'You can update your preferences and manage data permissions anytime in your account settings.',
  },
];
import { getStoredAiConciergeConsent, setStoredAiConciergeConsent } from '../utils/aiConciergeConsent';

// The post-login consent gate — LoginScreen/RegisterScreen route here once,
// right after a User account's first-ever sign-in or sign-up (checked via
// `aiConciergeConsentAt` being unset on the account — see their goAfterAuth/
// profile-completion handlers), carrying `redirectTo`/`redirectParams` for
// wherever that login would otherwise have landed. It never shows again for
// that account afterward. Also reachable any time after via the "Privacy
// Preferences" link on LoginScreen (passing `reviewMode: true`), so a user
// can change or withdraw their choice per GDPR.
//
// A session always exists by the time this screen is reached (gate mode is
// post-login now), so submitting always syncs the choice to the backend
// account; that sync is never allowed to block navigation (see handleSubmit).
// The local AsyncStorage copy (aiConciergeConsent.ts) is kept only as an
// offline-friendly cache for pre-filling this screen, not as the source of
// truth for whether the gate should show.
//
// Two modes:
//  - 'gate': the post-login first-ever visit — submitting continues to
//    `route.params.redirectTo` (defaults to Home) next.
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

    // Best-effort account sync — a session always exists by now (gate mode
    // is post-login), so this normally runs in both modes. Never blocks
    // navigation below, same reasoning as ScannerScreen's best-effort
    // scan/record.
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
      const redirectTo = route?.params?.redirectTo || 'Home';
      const redirectParams = route?.params?.redirectParams || {};
      navigation.replace(redirectTo, redirectParams);
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

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerOrnament} />
                <View style={styles.dividerLine} />
              </View>

              {FEATURES.map((feature) => (
                <View key={feature.icon} style={styles.featureRow}>
                  <View style={styles.featureIconCircle}>
                    <Icon name={feature.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerOrnament} />
                <View style={styles.dividerLine} />
              </View>

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
                  {consent === true && (
                    <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} to={colors.primaryDark} />
                  )}
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
              <GradientButton
                style={[styles.button, (saving || consent === null) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={saving || consent === null}
                to={colors.primaryDark}
              >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Continue'}</Text>
              </GradientButton>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerOrnament: {
    width: 6,
    height: 6,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
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
