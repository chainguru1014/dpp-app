import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { API_BASE_URL } from '../config/api';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow } from '../theme';

interface TransferConfirmScreenProps {
  route: any;
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

const METHODS: Array<'sale' | 'export_to_store' | 'distribute_to_shop' | 'gift' | 'lease' | 'return'> = [
  'sale', 'export_to_store', 'distribute_to_shop', 'gift', 'lease', 'return',
];

export default function TransferConfirmScreen({ route, navigation, user, onLogout }: TransferConfirmScreenProps) {
  const { t } = useI18n();
  const code = route?.params?.code;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transfer, setTransfer] = useState<any>(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<typeof METHODS[number]>('sale');

  const isAuthenticated = !!user;

  const getFileUrl = (filename: string) => {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
    if (filename.startsWith('/files/')) return `${API_BASE_URL}${filename.substring(1)}`;
    const clean = filename.startsWith('/') ? filename.substring(1) : filename;
    return `${API_BASE_URL}files/${clean}`;
  };

  const loadTransfer = async () => {
    if (!code) {
      setError(t('transferNotFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}transfer/${encodeURIComponent(code)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || t('transferNotFound'));
      }
      setTransfer(result.data);
      if (result.data?.method) setMethod(result.data.method);
    } catch (e: any) {
      setError(e?.message || t('transferNotFound'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfer();
  }, [code]);

  const goLogin = () => {
    navigation.navigate('Login', {
      redirectTo: 'TransferConfirm',
      redirectParams: { code },
    });
  };

  const actor = () => ({ kind: user?.actorKind || 'User', id: user?._id });

  const submit = async (action: 'confirm' | 'reject') => {
    if (!isAuthenticated) {
      goLogin();
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}transfer/${encodeURIComponent(code)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: actor(), method }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || t('error'));
      }
      Alert.alert(
        t('success'),
        action === 'confirm' ? t('transferConfirmed') : t('transferRejected'),
        [{ text: t('ok'), onPress: () => navigation.navigate(isAuthenticated ? 'Home' : 'Login') }]
      );
      await loadTransfer();
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderRow = (label: string, value?: string) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '-'}</Text>
    </View>
  );

  const snapshot = transfer?.productSnapshot || {};
  const buyer = transfer?.to_owner || {};
  const owner = transfer?.from_owner || {};
  const isPending = transfer?.status === 'pending';

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.navigate(isAuthenticated ? 'Home' : 'Login')}
      hideBottomBar
      onGuestAction={goLogin}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('transferConfirmTitle')}</Text>
        <Text style={styles.subtitle}>{t('transferConfirmSubtitle')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              {!!snapshot.image && (
                <Image source={{ uri: getFileUrl(snapshot.image) }} style={styles.productImage} resizeMode="cover" />
              )}
              {renderRow(t('productName'), snapshot.name)}
              {!!snapshot.model && renderRow(t('model'), snapshot.model)}
              {!!snapshot.brandName && renderRow(t('brand'), snapshot.brandName)}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>{t('buyerLabel')}</Text>
              {renderRow(t('username'), buyer.name)}
              {!!buyer.email && renderRow(t('email'), buyer.email)}
              {!!buyer.country && renderRow('Country', buyer.country)}
              <Text style={[styles.cardHeading, { marginTop: 14 }]}>{t('ownerLabel')}</Text>
              {renderRow(t('username'), owner.name)}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>{t('transferMethodLabel')}</Text>
              <View style={styles.methodWrap}>
                {METHODS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodChip, method === m && styles.methodChipActive]}
                    disabled={!isPending}
                    onPress={() => setMethod(m)}
                  >
                    <Text style={[styles.methodChipText, method === m && styles.methodChipTextActive]}>
                      {t(`method_${m}` as any)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!isPending && (
              <Text style={styles.statusNote}>{t('transferNotPending')}</Text>
            )}

            {!isAuthenticated ? (
              <View style={styles.card}>
                <Text style={styles.loginNote}>{t('loginToConfirm')}</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={goLogin}>
                  <Text style={styles.primaryButtonText}>{t('login')}</Text>
                </TouchableOpacity>
              </View>
            ) : isPending ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, submitting && { opacity: 0.6 }]}
                  disabled={submitting}
                  onPress={() => submit('reject')}
                >
                  <Text style={styles.secondaryButtonText}>{t('rejectTransfer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 1 }, submitting && { opacity: 0.6 }]}
                  disabled={submitting}
                  onPress={() => submit('confirm')}
                >
                  <Text style={styles.primaryButtonText}>
                    {submitting ? t('loading') : t('confirmTransfer')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '400',
    color: colors.heading,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.heading,
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: 12,
    backgroundColor: colors.surfaceAlt,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '400',
    flex: 1.4,
    textAlign: 'right',
  },
  methodWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginRight: 8,
    marginBottom: 8,
  },
  methodChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  methodChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '400',
  },
  methodChipTextActive: {
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: 10,
    flex: 1,
    ...shadow(1),
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '400',
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
  },
  statusNote: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  loginNote: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
});
