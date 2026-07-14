import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

// Deliberately separate screen and API surface (/employee-auth/*, not /auth/*)
// from the consumer login flow — the corporate-SSO route never shares a
// backend collection or endpoint with the consumer route. See
// backend/controllers/employeeAuthController.ts: the raw email typed below
// is used only to send the OTP mail and to check the domain allowlist; it is
// never written to the database, only a one-way hash of it.
export default function StaffLoginScreen({ navigation, onLogin }: any) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const RESEND_COOLDOWN_SECONDS = 60;

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const sendCode = async (targetEmail: string) => {
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}employee-auth/otp/request`, {
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
      setError(e?.message || 'Network error, please try again.');
      return false;
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid corporate email address.');
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
      setError('Enter the 6-digit code we emailed you.');
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch(`${API_BASE_URL}employee-auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: trimmedCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== 'success') {
        throw new Error(data?.message || 'That code did not work. Please try again.');
      }
      const tagged = { ...(data.employee || {}), actorKind: 'Employee' };
      await AsyncStorage.setItem('userToken', data.token || '');
      await AsyncStorage.setItem('user', JSON.stringify(tagged));
      onLogin?.(tagged);
      navigation.replace('EmployeeHome');
    } catch (e: any) {
      setError(e?.message || 'Network error, please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <Text style={styles.title}>Staff Login</Text>
            <Text style={styles.subtitle}>Sign in with your corporate email</Text>

            {stage === 'email' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="you@company.com"
                  placeholderTextColor={colors.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!requesting}
                />
                <TouchableOpacity style={[styles.button, requesting && styles.buttonDisabled]} onPress={handleSendCode} disabled={requesting}>
                  {requesting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send code</Text>}
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
                <TouchableOpacity style={[styles.button, verifying && styles.buttonDisabled]} onPress={handleVerifyCode} disabled={verifying || requesting}>
                  {verifying ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkButton} onPress={handleResendCode} disabled={verifying || requesting || resendCooldown > 0}>
                  <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.replace('Login')}>
              <Text style={styles.linkText}>Back to consumer sign-in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  kav: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card: { backgroundColor: '#f3f4f6', borderRadius: radius.xl, padding: spacing.xxxl, width: '100%', maxWidth: 380, ...shadow(3) },
  title: { fontSize: 22, fontWeight: '600', color: colors.heading, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.sm, color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
  helperText: { fontSize: fontSize.sm, color: colors.muted, marginBottom: spacing.sm, textAlign: 'center' },
  input: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, marginBottom: spacing.md, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.borderStrong },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', ...shadow(1) },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '400' },
  linkButton: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.navy, fontSize: 14, fontWeight: '400' },
  linkTextDisabled: { color: colors.muted },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'left' },
});
