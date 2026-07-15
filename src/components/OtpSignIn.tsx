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
import { API_BASE_URL } from '../config/api';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

interface OtpSignInProps {
  // Called with the envelope returned by POST auth/otp/verify: { user, token, profileCompleted, ... }
  onSuccess: (result: { user: any; token: string; profileCompleted: boolean }) => void;
  onError?: (error: string) => void;
  // Controlled by the parent (LoginScreen) so the Sign In/Sign Up toggle can
  // be rendered at the bottom of the card instead of inline here.
  mode: 'signin' | 'signup';
}

// NOTE: this component's copy is plain English literals rather than the
// app's t()-based i18n system — see the comment in AppleAuthButton.tsx for
// why (translations.ts is a large, strictly-typed 5-locale table; adding a
// dozen-plus new OTP-flow strings to it is left as a follow-up pass rather
// than a side effect of the passwordless-auth migration).
export default function OtpSignIn({ onSuccess, onError, mode }: OtpSignInProps) {
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

  const reportError = (msg: string) => {
    setError(msg);
    onError?.(msg);
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
        throw new Error(data?.message || 'Could not send the code. Please try again.');
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (e: any) {
      reportError(e?.message || 'Network error, please try again.');
      return false;
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('');
      reportError('Please enter a valid email address.');
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

  const handleVerifyCode = async () => {
    setError('');
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      reportError('Enter the 6-digit code we emailed you.');
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
        throw new Error(data?.message || 'That code did not work. Please try again.');
      }
      const userData = data.user || data.data;
      if (!userData) {
        throw new Error('Invalid response from server.');
      }
      onSuccess({
        user: userData,
        token: data.token || '',
        profileCompleted: userData.profileCompleted !== false,
      });
    } catch (e: any) {
      reportError(e?.message || 'Network error, please try again.');
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
      <Text style={styles.sectionLabel}>
        {mode === 'signup' ? 'Create your account with an email code' : 'Sign in with email code'}
      </Text>

      {stage === 'email' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!requesting}
          />
          <TouchableOpacity
            style={[styles.button, requesting && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'signup' ? 'Create account' : 'Send code'}</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.helperText}>Enter the 6-digit code sent to {email.trim()}</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor={colors.placeholder}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            editable={!verifying && !requesting}
          />
          <TouchableOpacity
            style={[styles.button, verifying && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={verifying || requesting}
          >
            {verifying ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleResendCode}
            disabled={verifying || requesting || resendCooldown > 0}
          >
            {requesting ? (
              <ActivityIndicator color={colors.navy} size="small" />
            ) : (
              <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={handleChangeEmail} disabled={verifying}>
            <Text style={styles.linkText}>Use a different email</Text>
          </TouchableOpacity>
        </>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  helperText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '400',
  },
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    color: colors.navy,
    fontSize: 14,
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
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'left',
  },
});
