import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AppleAuthButton from '../components/AppleAuthButton';
import OtpSignIn from '../components/OtpSignIn';
import FaceCapture, { FaceFailure, FaceMode } from '../components/FaceCapture';
import { authTileStyles, AUTH_TILE_ICON, AUTH_TILE_ICON_MAIN } from '../components/authTileStyles';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { AuthMethod, loadAuthPrefs, rememberAuthMethod } from '../utils/authPrefs';
import { colors, spacing, radius, shadow, MIN_TOUCH } from '../theme';

type AuthResult = { user: any; token: string; profileCompleted: boolean; mode?: 'signin' | 'signup'; actorKind?: 'User' | 'Employee' };

const FACE_FAILURE_KEY: Record<FaceFailure, any> = {
  notConfigured: 'faceErrNotConfigured',
  permission: 'faceErrPermission',
  noFace: 'faceErrNoFace',
  unrecognized: 'faceErrUnrecognized',
  duplicate: 'faceErrDuplicate',
  spoof: 'faceErrSpoof',
  cancelled: null,
  failed: 'faceErrFailed',
};

// One screen for both Signup and Login. A device that has never finished a
// signup/sign-in sees Signup; afterwards it sees Login with the method used
// last time already open (Face starts scanning straight away, Email shows
// its field), plus "Login another way" for the full list. Methods, in order
// of prominence: Face (main), Google / Apple, Email.
export default function LoginScreen({ navigation, onLogin, route }: any) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [apiError, setApiError] = useState('');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [remembered, setRemembered] = useState<AuthMethod | null>(null);
  // The single method currently opened (remembered one, or Email tapped from the list).
  const [openMethod, setOpenMethod] = useState<AuthMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [faceRun, setFaceRun] = useState<null | { mode: FaceMode; payload?: any; ticket?: string }>(null);
  const autoFaceStartedRef = useRef(false);

  useEffect(() => {
    loadAuthPrefs().then(({ hasAccount, method }) => {
      setAuthMode(hasAccount ? 'signin' : 'signup');
      setRemembered(hasAccount ? method : null);
      setOpenMethod(hasAccount ? method : null);
      setPrefsLoaded(true);
    });
  }, []);

  // Corporate employee sessions always land on the operations home, never on
  // the consumer redirect target the route may have been carrying (e.g. a
  // deep link into a product page) — that flow doesn't apply to staff, nor
  // does the AI Concierge consent gate below (backend only tracks it for
  // User accounts).
  const goAfterAuth = (actorKind: 'User' | 'Employee', userData?: any) => {
    if (actorKind === 'Employee') {
      navigation.replace('EmployeeHome');
      return;
    }
    const redirectTo = route?.params?.redirectTo;
    const redirectParams = route?.params?.redirectParams;
    // First-ever sign-in/sign-up for this account (aiConciergeConsentAt unset)
    // — route through the consent gate once, carrying along wherever this
    // login would otherwise have landed so the gate's Continue button sends
    // the user there next instead of back to Login.
    if (userData && !userData.aiConciergeConsentAt) {
      navigation.replace('AiConciergeConsent', {
        redirectTo: redirectTo || 'Scanner',
        redirectParams: redirectParams || {},
      });
      return;
    }
    if (redirectTo) {
      navigation.replace(redirectTo, redirectParams || {});
      return;
    }
    navigation.replace('Scanner');
  };

  // Tag the session with which kind of account this is so ownership-transfer
  // confirmation can identify the acting party (User vs Company/brand), and
  // so the rest of the app (AppLayout, product-facing screens) knows which
  // UI branch to render — see isEmployeeActor usage throughout.
  const finalizeLogin = async (userData: any, token: string, actorKind: 'User' | 'Employee') => {
    const tagged = { ...userData, actorKind };
    await AsyncStorage.setItem('userToken', token || '');
    await AsyncStorage.setItem('user', JSON.stringify(tagged));
    if (onLogin) {
      onLogin(tagged);
    }
    goAfterAuth(actorKind, tagged);
  };

  // Shared handler for every method. If the backend says the profile isn't
  // complete yet (new account, or one that never finished onboarding), stash
  // the token/partial user and route to the profile page (RegisterScreen)
  // instead. Exception: email OTP sign-in (mode === 'signin') never requires
  // profile completion — auth/otp/request only succeeds for an email that's
  // already registered, so an incomplete profile there means an old
  // abandoned signup, not someone who needs onboarding right now. Employee
  // accounts have no profile-completion concept at all.
  const handleAuthSuccess = async (method: AuthMethod, { user, token, profileCompleted, mode, actorKind }: AuthResult) => {
    setApiError('');
    const kind: 'User' | 'Employee' = actorKind === 'Employee' ? 'Employee' : 'User';
    await rememberAuthMethod(method);
    if (kind === 'User' && !profileCompleted && mode !== 'signin') {
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
    await finalizeLogin(user, token, kind);
  };

  const handleAuthError = (message: string) => {
    setApiError(message);
  };

  const postJson = async (path: string, body: any = {}) => {
    const r = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.status !== 'success') throw new Error(j?.message || t('faceErrFailed'));
    return j;
  };

  // Face — Signup: create the account, enroll the face with its id as the
  // FACEIO payload, then attach the Facial ID. Login: authenticate the face,
  // then let the backend confirm it with FACEIO and issue the session.
  const startFace = async () => {
    if (busy || faceRun) return;
    setApiError('');
    if (authMode === 'signin') {
      setFaceRun({ mode: 'authenticate' });
      return;
    }
    setBusy(true);
    try {
      const j = await postJson('auth/face/signup/start');
      setFaceRun({ mode: 'enroll', payload: { uid: j.userId }, ticket: j.signupTicket });
    } catch (e: any) {
      setApiError(e?.message || t('faceErrFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onFaceSuccess = async (facialId: string) => {
    const run = faceRun;
    setFaceRun(null);
    if (!run) return;
    setBusy(true);
    try {
      const j = run.mode === 'enroll'
        ? await postJson('auth/face/signup/complete', { signupTicket: run.ticket, facialId })
        : await postJson('auth/face/login', { facialId });
      // Face accounts always go through the profile page until it's done —
      // that's where they add their email.
      await handleAuthSuccess('face', {
        user: j.user,
        token: j.token,
        profileCompleted: !!j.user?.profileCompleted,
        mode: 'signup',
        actorKind: 'User',
      });
    } catch (e: any) {
      setApiError(e?.message || t('faceErrFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onFaceFailure = (reason: FaceFailure) => {
    setFaceRun(null);
    const key = FACE_FAILURE_KEY[reason];
    if (key) setApiError(t(key));
  };

  // Remembered Face: start scanning without a tap.
  useEffect(() => {
    if (!prefsLoaded || autoFaceStartedRef.current) return;
    if (authMode === 'signin' && openMethod === 'face' && remembered === 'face') {
      autoFaceStartedRef.current = true;
      startFace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, authMode, openMethod, remembered]);

  const switchMode = () => {
    setApiError('');
    setOpenMethod(null);
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  };

  const onGoogleApple = (method: AuthMethod) => (r: AuthResult) => handleAuthSuccess(method, r);

  // ---- tiles ----

  const faceTile = (main: boolean) => (
    <TouchableOpacity
      style={[authTileStyles.tile, main && authTileStyles.tileMain, busy && styles.dim]}
      onPress={startFace}
      disabled={busy}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('authFace')}
    >
      {busy ? (
        <ActivityIndicator color={main ? colors.white : colors.primary} size="large" />
      ) : (
        <MaterialCommunityIcon
          name="face-recognition"
          size={main ? AUTH_TILE_ICON_MAIN : AUTH_TILE_ICON}
          color={main ? colors.white : colors.primary}
        />
      )}
      <Text style={[authTileStyles.label, main && authTileStyles.labelMain]}>
        {busy ? t('authPleaseWait') : main && openMethod === 'face' ? t('authFaceTapToStart') : t('authFace')}
      </Text>
    </TouchableOpacity>
  );

  const emailTile = (
    <TouchableOpacity
      style={authTileStyles.tile}
      onPress={() => { setApiError(''); setOpenMethod('email'); }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('authEmail')}
    >
      <MaterialCommunityIcon name="email-outline" size={AUTH_TILE_ICON} color={colors.primary} />
      <Text style={authTileStyles.label}>{t('authEmail')}</Text>
    </TouchableOpacity>
  );

  const renderOpenMethod = () => {
    switch (openMethod) {
      case 'face':
        return faceTile(true);
      case 'google':
        return (
          <View style={styles.singleRow}>
            <GoogleAuthButton variant="tile" onSuccess={onGoogleApple('google')} onError={handleAuthError} navigation={navigation} />
          </View>
        );
      case 'apple':
        return (
          <View style={styles.singleRow}>
            <AppleAuthButton variant="tile" onSuccess={onGoogleApple('apple')} onError={handleAuthError} />
          </View>
        );
      case 'email':
        return (
          <View style={styles.emailBox}>
            <MaterialCommunityIcon name="email-outline" size={AUTH_TILE_ICON} color={colors.primary} style={styles.emailIcon} />
            <OtpSignIn onSuccess={(r) => handleAuthSuccess('email', r)} onError={handleAuthError} mode={authMode} />
          </View>
        );
      default:
        return null;
    }
  };

  const renderAllMethods = () => (
    <>
      {faceTile(true)}
      <View style={styles.tileRow}>
        <GoogleAuthButton variant="tile" onSuccess={onGoogleApple('google')} onError={handleAuthError} navigation={navigation} />
        <AppleAuthButton variant="tile" onSuccess={onGoogleApple('apple')} onError={handleAuthError} />
      </View>
      <View style={styles.tileRow}>{emailTile}</View>
    </>
  );

  return (
    <ImageBackground source={require('../assets/bg-intro-dpp.jpg')} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} pointerEvents="none" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../assets/yometel-logo-white.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Yometel"
          />

          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">
              {authMode === 'signup' ? t('authSignUpTitle') : t('authSignInTitle')}
            </Text>

            {!!apiError && (
              <View style={styles.apiErrorBox} accessibilityRole="alert">
                <Icon name="error-outline" size={22} color={colors.danger} />
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            )}

            {!prefsLoaded ? (
              <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: spacing.xxxl }} />
            ) : openMethod ? (
              <>
                {renderOpenMethod()}
                <TouchableOpacity
                  style={styles.anotherWay}
                  onPress={() => { setApiError(''); setOpenMethod(null); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={authMode === 'signup' ? t('authSignupAnotherWay') : t('authLoginAnotherWay')}
                >
                  <Icon name="apps" size={24} color={colors.primary} />
                  <Text style={styles.anotherWayText}>
                    {authMode === 'signup' ? t('authSignupAnotherWay') : t('authLoginAnotherWay')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              renderAllMethods()
            )}

            <TouchableOpacity
              style={styles.authModeLink}
              onPress={switchMode}
              accessibilityRole="button"
              accessibilityLabel={authMode === 'signin' ? `${t('noAccount')} ${t('signUp')}` : `${t('haveAccount')} ${t('signIn')}`}
            >
              <Text style={styles.authModeLinkText}>
                {authMode === 'signin' ? `${t('noAccount')} ${t('signUp')}` : `${t('haveAccount')} ${t('signIn')}`}
              </Text>
            </TouchableOpacity>

            {/* GDPR: lets a user reopen the AI Concierge consent screen at any
                time to review or change their locally-stored choice — see
                AiConciergeConsentScreen. */}
            <TouchableOpacity
              style={styles.privacyLink}
              onPress={() => navigation.navigate('AiConciergeConsent', { reviewMode: true })}
              accessibilityRole="button"
              accessibilityLabel={t('privacyPreferences')}
            >
              <Text style={styles.privacyLinkText}>{t('privacyPreferences')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FaceCapture
        visible={!!faceRun}
        mode={faceRun?.mode || 'authenticate'}
        payload={faceRun?.payload}
        onSuccess={onFaceSuccess}
        onFailure={onFaceFailure}
      />
    </ImageBackground>
  );
}

const webFill = Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark, ...webFill },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,42,64,0.35)' },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  logo: { width: 190, height: 56, marginBottom: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow(3),
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: spacing.xs },
  tileRow: { flexDirection: 'row', gap: spacing.md },
  singleRow: { flexDirection: 'row' },
  dim: { opacity: 0.7 },
  emailBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow(1),
  },
  emailIcon: { alignSelf: 'center', marginBottom: spacing.sm },
  anotherWay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  anotherWayText: { fontSize: 19, fontWeight: '600', color: colors.primary },
  apiErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  apiErrorText: { flex: 1, color: colors.danger, fontSize: 18 },
  authModeLink: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  authModeLinkText: { fontSize: 19, fontWeight: '600', color: colors.primary },
  privacyLink: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  privacyLinkText: { fontSize: 17, color: colors.muted, textDecorationLine: 'underline' },
});
