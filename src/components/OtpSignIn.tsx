import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL } from '../config/api';
import GradientButton from './GradientButton';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, fontSize, shadow, MIN_TOUCH } from '../theme';

// mm:ss for cooldowns under an hour (always true here — 60s max) — "0:58" not "58s".
function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface OtpSignInProps {
  // Called with the envelope returned by POST auth/otp/verify: { user, token, profileCompleted, ... }
  // plus the mode this verification ran under, so the parent can decide
  // whether an incomplete profile should block sign-in (see LoginScreen).
  onSuccess: (result: { user: any; token: string; profileCompleted: boolean; mode: 'signin' | 'signup'; actorKind: 'User' | 'Employee' }) => void;
  onError?: (error: string) => void;
  // Controlled by the parent (LoginScreen) so the Sign In/Sign Up toggle can
  // be rendered at the bottom of the card instead of inline here.
  mode: 'signin' | 'signup';
}

export default function OtpSignIn({ onSuccess, onError, mode }: OtpSignInProps) {
  const { t } = useI18n();
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Must match the backend's per-email resend cooldown (see authController.otpRequest) —
  // a shorter client cooldown would let users retry before the server accepts it, guaranteeing a 429.
  const RESEND_COOLDOWN_SECONDS = 60;

  // Counts the resend cooldown down to 0 once a code has been (re)sent.
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Clear any stale error when the parent flips Sign In <-> Sign Up.
  useEffect(() => {
    setError('');
  }, [mode]);

  // Local-only: this component already renders its own error box right below
  // the email/code input, so it does NOT bubble up via onError — that prop
  // exists for LoginScreen's Google/Apple buttons, which have no inline
  // error UI of their own. Bubbling both would show the same message twice.
  const reportError = (msg: string) => {
    setError(msg);
  };

  const sendCode = async (targetEmail: string) => {
    setError('');
    try {
      const endpoint = mode === 'signup' ? 'auth/signup/otp/request' : 'auth/otp/request';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || t('otpSendFailed'));
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (e: any) {
      reportError(e?.message || t('networkErrorRetry'));
      return false;
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('');
      reportError(t('otpInvalidEmail'));
      return;
    }
    setRequesting(true);
    const ok = await sendCode(trimmed);
    setRequesting(false);
    if (ok) setStage('code');
  };

  const handleResendCode = async () => {
    if (requesting || verifying || resendCooldown > 0) return;
    setRequesting(true);
    await sendCode(email.trim());
    setRequesting(false);
  };

  const handleVerifyCode = async (codeOverride?: string) => {
    setError('');
    const trimmedCode = (codeOverride ?? code).trim();
    if (trimmedCode.length !== 6) {
      reportError(t('otpEnterFullCode'));
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch(`${API_BASE_URL}auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: trimmedCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== 'success') {
        throw new Error(data?.message || t('otpVerifyFailed'));
      }
      const userData = data.user || data.data;
      if (!userData) {
        throw new Error(t('invalidServerResponse'));
      }
      onSuccess({
        user: userData,
        token: data.token || '',
        profileCompleted: userData.profileCompleted !== false,
        mode,
        actorKind: data.actorKind === 'Employee' ? 'Employee' : 'User',
      });
    } catch (e: any) {
      reportError(e?.message || t('networkErrorRetry'));
      // Auto-submit failed (e.g. wrong code) -- clear the field so the user
      // can retype rather than staring at 6 digits that didn't work.
      if (codeOverride) setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleChangeEmail = () => {
    setStage('email');
    setCode('');
    setError('');
  };

  return (
    <View style={styles.container}>
      {stage === 'email' ? (
        <>
          <View style={styles.inputWrap}>
            <Icon name="mail-outline" size={18} color={colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder={t('otpEmailPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!requesting}
              accessibilityLabel={t('email')}
            />
          </View>
          {!!error && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <GradientButton
            style={[styles.button, requesting && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={requesting}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signup' ? t('createAccount') : t('otpSendCode')}
            accessibilityState={{ disabled: requesting, busy: requesting }}
          >
            {requesting ? (
              <View style={styles.buttonLoadingRow}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.buttonText}>{t('otpSendingCode')}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{mode === 'signup' ? t('createAccount') : t('otpSendCode')}</Text>
            )}
          </GradientButton>
        </>
      ) : (
        <>
          <Text style={styles.helperText}>
            {t('otpCodeSentTo')}{'\n'}
            <Text style={styles.helperEmail}>{email.trim()}</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('otpCodePlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/[^0-9]/g, '').slice(0, 6);
              setCode(digits);
              // Auto-submit once all 6 digits are in — the Verify button below
              // stays as an explicit fallback for anyone who'd rather tap it.
              if (digits.length === 6 && !verifying && !requesting) {
                handleVerifyCode(digits);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!verifying && !requesting}
            accessibilityLabel={t('otpCodePlaceholder')}
          />
          {!!error && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <GradientButton
            style={[styles.button, verifying && styles.buttonDisabled]}
            onPress={() => handleVerifyCode()}
            disabled={verifying || requesting}
            accessibilityRole="button"
            accessibilityLabel={t('otpVerify')}
            accessibilityState={{ disabled: verifying, busy: verifying }}
          >
            {verifying ? (
              <View style={styles.buttonLoadingRow}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.buttonText}>{t('otpVerifyingCode')}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{t('otpVerify')}</Text>
            )}
          </GradientButton>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleResendCode}
            disabled={verifying || requesting || resendCooldown > 0}
            accessibilityRole="button"
            accessibilityLabel={resendCooldown > 0 ? t('otpResendIn').replace('{time}', formatCountdown(resendCooldown)) : t('otpResendCode')}
            accessibilityState={{ disabled: verifying || requesting || resendCooldown > 0 }}
          >
            {requesting ? (
              <ActivityIndicator color={colors.navy} size="small" />
            ) : (
              <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
                {resendCooldown > 0 ? t('otpResendIn').replace('{time}', formatCountdown(resendCooldown)) : t('otpResendCode')}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleChangeEmail}
            disabled={verifying}
            accessibilityRole="button"
            accessibilityLabel={t('otpUseDifferentEmail')}
          >
            <Text style={styles.linkText}>{t('otpUseDifferentEmail')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  helperText: {
    fontSize: fontSize.md,
    color: colors.muted,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  helperEmail: {
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    height: MIN_TOUCH,
    paddingVertical: 0,
    paddingHorizontal: 16,
    marginBottom: spacing.md,
    fontSize: 19,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    height: MIN_TOUCH,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputIcon: { marginRight: 8 },
  inputField: { flex: 1, fontSize: 19, color: colors.text, paddingVertical: 0 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 54,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: spacing.sm,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.navy,
    fontSize: 21,
    fontWeight: '400',
  },
  linkTextDisabled: {
    color: colors.muted,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 18,
    textAlign: 'left',
  },
});
