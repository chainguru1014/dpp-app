import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface Props {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

const fileUrl = (f: string) => {
  if (!f) return '';
  if (/^https?:\/\//i.test(f)) return f;
  return `${API_BASE_URL}files/${String(f).replace(/^\/+/, '')}`;
};
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

export default function SendProductInfoScreen({ navigation, route, user, onLogout }: Props) {
  const { t } = useI18n();
  const product = route?.params?.product || {};
  const infoText: string = route?.params?.infoText || '';
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const img = Array.isArray(product?.images) && product.images.length ? fileUrl(product.images[0]) : '';

  const send = async () => {
    if (!isValidEmail(email)) {
      Alert.alert(t('error'), 'Please enter a valid email address');
      return;
    }
    setSending(true);
    try {
      const content = [message.trim(), infoText].filter(Boolean).join('\n\n');
      const res = await fetch(`${API_BASE_URL}engagement/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: email.trim(), subject: `${product?.name || 'Product'} — product information`, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Failed to send');
      Alert.alert(t('success'), t('sendInfoSuccess'), [{ text: t('ok'), onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{t('sendInfoHeading')}</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('sendInfoRecipientPlaceholder')}
          placeholderTextColor={colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.sectionLabel}>{t('sendInfoPreview')}</Text>
        <View style={styles.previewCard}>
          {img ? (
            <Image source={{ uri: img }} style={styles.previewImg} resizeMode="cover" />
          ) : (
            <View style={[styles.previewImg, styles.previewImgPlaceholder]}>
              <Icon name="inventory-2" size={20} color={colors.placeholder} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName} numberOfLines={1}>{product?.name || '—'}</Text>
            {!!product?.brandInfo?.name && <Text style={styles.previewSub} numberOfLines={1}>{product.brandInfo.name}</Text>}
            {(product?.pmc_code || product?.token_id != null) && (
              <Text style={styles.previewId} numberOfLines={1}>ID: {product?.pmc_code || product?.token_id}</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('sendInfoMessageLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={(v) => setMessage(v.slice(0, 200))}
          placeholder={t('sendInfoMessagePlaceholder')}
          placeholderTextColor={colors.placeholder}
          multiline
        />

        <GradientButton style={styles.sendBtn} onPress={send} disabled={sending} activeOpacity={0.85}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>{t('send')}</Text>}
        </GradientButton>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heading: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  sectionLabel: { fontSize: 12, color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.xs },
  previewCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow(1),
  },
  previewImg: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  previewImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 14, fontWeight: '700', color: colors.heading },
  previewSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  previewId: { fontSize: 11, color: colors.placeholder, marginTop: 2 },
  sendBtn: { marginTop: spacing.xl, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow(1) },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
