import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow } from '../theme';
import { resolveScannedCode, ManualCodeType } from '../utils/resolveScannedCode';

interface EnterCodeScreenProps {
  navigation: any;
  route?: any;
  user?: any;
  onLogout?: () => void;
}

const TYPES: { value: ManualCodeType; labelKey: any; icon: string }[] = [
  { value: 'qrcode', labelKey: 'enterCodeTypeQr', icon: 'qr-code-2' },
  { value: 'barcode', labelKey: 'enterCodeTypeBarcode', icon: 'view-week' },
  { value: 'rfid', labelKey: 'enterCodeTypeRfid', icon: 'wifi-tethering' },
  { value: 'gs1dl', labelKey: 'enterCodeTypeGs1', icon: 'link' },
];

export default function EnterCodeScreen({ navigation, route, user, onLogout }: EnterCodeScreenProps) {
  const { t } = useI18n();
  const [type, setType] = useState<ManualCodeType>('qrcode');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const expectedSecurityQrUrl = String(route?.params?.expectedSecurityQrUrl || '').trim();

  const check = async () => {
    const v = value.trim();
    if (!v || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await resolveScannedCode(v, type, {
        userId: user?._id ? String(user._id) : undefined,
        expectedSecurityQrUrl: expectedSecurityQrUrl || undefined,
      });
      if (result.kind === 'transfer') {
        navigation.navigate('TransferConfirm', { code: result.code });
        return;
      }
      navigation.replace('ScanSuccessful', {
        productData: result.productData,
        securityPassed: true,
      });
    } catch (err: any) {
      setError(err?.message || t('failedToDecryptProduct'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.prompt}>{t('enterCodePrompt')}</Text>

        <View style={styles.typeRow}>
          {TYPES.map((opt) => {
            const active = type === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.typeTile, active && styles.typeTileActive]}
                onPress={() => setType(opt.value)}
                activeOpacity={0.8}
              >
                <Icon name={opt.icon} size={22} color={active ? colors.primary : colors.muted} />
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>{t('enterCodeLabel')}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(v) => {
              setValue(v);
              if (error) setError('');
            }}
            placeholder={t('enterCodePlaceholder')}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={check}
          />
          {value.length > 0 && (
            <TouchableOpacity onPress={() => setValue('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="cancel" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <GradientButton
          style={[styles.checkButton, (!value.trim() || loading) && styles.checkButtonDisabled]}
          onPress={check}
          disabled={!value.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkButtonText}>{t('enterCodeCheck')}</Text>
          )}
        </GradientButton>

        <View style={styles.hintCard}>
          <Icon name="info-outline" size={18} color={colors.primary} />
          <Text style={styles.hintText}>{t('enterCodeHint')}</Text>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  prompt: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  typeTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  typeTileActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  typeLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textAlign: 'center' },
  typeLabelActive: { color: colors.primary },
  label: { fontSize: 14, fontWeight: '700', color: colors.heading, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  checkButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow(1),
  },
  checkButtonDisabled: { opacity: 0.5 },
  checkButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hintCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  hintText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 18 },
});
