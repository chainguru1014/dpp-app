import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Modal, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientButton from './GradientButton';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { radius, spacing, MIN_TOUCH } from '../theme';
import type { Palette } from '../utils/dppTheme';
import { RequestStatus, SERVICE_META, STATUS_KEY, Service, readyServices } from '../utils/circularity';

type ServiceRequest = {
  _id: string;
  ref: string;
  kind: Service['kind'];
  status: RequestStatus;
  message: string;
  reply?: string;
  createdAt?: string;
};

type Props = {
  product: any;
  qrcodeId?: number | string | null;
  /** The signed-in shopper; staff and signed-out visitors cannot send requests. */
  user?: any;
  palette: Palette;
  /** Fill of the main button, from the brand's look. */
  button: { from: string; to: string };
  buttonRadius?: number;
  cardStyle: any;
  cardTitleStyle: any;
  onSignIn?: () => void;
};

const STATUS_TONE: Record<RequestStatus, 'wait' | 'good' | 'bad' | 'off'> = {
  new: 'wait', accepted: 'wait', in_progress: 'wait', completed: 'good', declined: 'bad', cancelled: 'off',
};

const openUrl = (url: string) => {
  if (!url) return;
  if (Platform.OS === 'web') (globalThis as any)?.open?.(url, '_blank', 'noopener,noreferrer');
  else Linking.openURL(url).catch(() => {});
};
const openWeb = (url: string) => openUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);

/**
 * A product's end-of-life services (repair, resell, rent, recycle): what the
 * brand offers, how each works and who to contact. Where the brand takes
 * requests, a signed-in shopper can send one here and follow its status and
 * the brand's answer.
 */
export default function ProductServices({ product, qrcodeId, user, palette, button, buttonRadius, cardStyle, cardTitleStyle, onSignIn }: Props) {
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const services = useMemo(() => readyServices(product), [product]);
  const [open, setOpen] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [form, setForm] = useState<Service | null>(null);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isShopper = !!user && user.actorKind !== 'Employee';
  const productId = product?._id;
  const shape = buttonRadius != null ? { borderRadius: buttonRadius } : null;

  const authHeaders = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const loadRequests = async () => {
    if (!isShopper || !productId) return;
    try {
      const response = await fetch(`${API_BASE_URL}circular/requests/mine?product_id=${encodeURIComponent(String(productId))}`, { headers: await authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data?.data)) setRequests(data.data);
    } catch (e) {
      // The list is an extra: the services themselves still show.
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user?._id]);

  const startRequest = (service: Service) => {
    setError('');
    setNotice('');
    setMessage('');
    setPhone(String(user?.phoneNumber || ''));
    setForm(service);
  };

  const sendRequest = async () => {
    if (!form) return;
    if (message.trim().length < 5) {
      setError(t('svcTooShort'));
      return;
    }
    setSending(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}circular/requests`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          product_id: productId,
          kind: form.kind,
          qrcode_id: qrcodeId ?? undefined,
          message: message.trim(),
          contact: { phone: phone.trim() },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || t('svcSendFailed'));
      setForm(null);
      setNotice(`${t('svcSent')} (${data?.data?.ref || ''})`);
      loadRequests();
    } catch (e: any) {
      setError(e?.message || t('svcSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}circular/requests/${id}/cancel`, { method: 'PUT', headers: await authHeaders() });
      if (response.ok) loadRequests();
    } catch (e) {
      // Left as it was; the shopper can try again.
    }
  };

  return (
    <View>
      <View style={cardStyle}>
        <Text style={cardTitleStyle}>{t('lifecycleExtendLife')}</Text>
        {services.length === 0 && <Text style={styles.empty}>{t('svcNone')}</Text>}
        {!!notice && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Icon name="check-circle" size={20} color={palette.success} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
        {services.map((s, i) => {
          const meta = SERVICE_META[s.kind];
          const expanded = open === s.kind;
          const facts: [string, string][] = ([[t(meta.cost), s.cost], [t(meta.time), s.time], [t(meta.note), s.note]] as [string, string][]).filter(([, v]) => !!v);
          return (
            <View key={s.kind} style={[styles.service, i < services.length - 1 && styles.serviceDivider]}>
              <TouchableOpacity
                style={styles.head}
                onPress={() => setOpen(expanded ? null : s.kind)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${t(meta.title)}. ${s.summary}`}
              >
                <View style={styles.icon}><Icon name={meta.icon} size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{t(meta.title)}</Text>
                  {!!s.summary && <Text style={styles.summary}>{s.summary}</Text>}
                </View>
                <Icon name={expanded ? 'expand-less' : 'expand-more'} size={24} color={palette.muted} />
              </TouchableOpacity>

              {expanded && (
                <View style={styles.body}>
                  {facts.map(([label, value]) => (
                    <View key={label} style={styles.fact}>
                      <Text style={styles.factLabel}>{label}</Text>
                      <Text style={styles.factValue}>{value}</Text>
                    </View>
                  ))}
                  {s.steps.length > 0 && (
                    <View style={styles.fact}>
                      <Text style={styles.factLabel}>{t('svcHowItWorks')}</Text>
                      {s.steps.map((step, si) => (
                        <View key={si} style={styles.step}>
                          <View style={styles.stepNo}><Text style={styles.stepNoText}>{si + 1}</Text></View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {!!s.partnerName && (
                    <View style={styles.fact}>
                      <Text style={styles.factLabel}>{t('svcProvider')}</Text>
                      <Text style={styles.factValue}>{s.partnerName}</Text>
                    </View>
                  )}

                  {s.acceptRequests && isShopper && (
                    <GradientButton style={[styles.mainButton, shape]} from={button.from} to={button.to} onPress={() => startRequest(s)}>
                      <Text style={styles.mainButtonText}>{t(meta.button)}</Text>
                    </GradientButton>
                  )}
                  {s.acceptRequests && !user && (
                    <TouchableOpacity style={[styles.linkButton, shape]} onPress={onSignIn} disabled={!onSignIn} accessibilityRole="button">
                      <Icon name="login" size={20} color={palette.primary} />
                      <Text style={styles.linkButtonText}>{t('svcSignInToRequest')}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.links}>
                    {!!s.url && (
                      <TouchableOpacity style={[styles.linkButton, shape]} onPress={() => openWeb(s.url)} accessibilityRole="link">
                        <Icon name="open-in-new" size={20} color={palette.primary} />
                        <Text style={styles.linkButtonText}>{t('svcOpenWebsite')}</Text>
                      </TouchableOpacity>
                    )}
                    {!!s.email && (
                      <TouchableOpacity style={[styles.linkButton, shape]} onPress={() => openUrl(`mailto:${s.email}`)} accessibilityRole="link" accessibilityLabel={`${t('svcEmail')}: ${s.email}`}>
                        <Icon name="mail-outline" size={20} color={palette.primary} />
                        <Text style={styles.linkButtonText}>{t('svcEmail')}</Text>
                      </TouchableOpacity>
                    )}
                    {!!s.phone && (
                      <TouchableOpacity style={[styles.linkButton, shape]} onPress={() => openUrl(`tel:${s.phone.replace(/[^\d+]/g, '')}`)} accessibilityRole="link" accessibilityLabel={`${t('svcCall')}: ${s.phone}`}>
                        <Icon name="call" size={20} color={palette.primary} />
                        <Text style={styles.linkButtonText}>{t('svcCall')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {requests.length > 0 && (
        <View style={cardStyle}>
          <Text style={cardTitleStyle}>{t('svcMyRequests')}</Text>
          {requests.map((r, i) => {
            const tone = STATUS_TONE[r.status] || 'wait';
            const toneColor = tone === 'good' ? palette.success : tone === 'bad' ? palette.danger : tone === 'off' ? palette.muted : palette.primary;
            return (
              <View key={r._id} style={[styles.request, i < requests.length - 1 && styles.serviceDivider]}>
                <View style={styles.requestHead}>
                  <Text style={styles.requestTitle}>{t(SERVICE_META[r.kind]?.title || 'svcRepair')} · {r.ref}</Text>
                  <View style={[styles.status, { borderColor: toneColor }]}>
                    <Text style={[styles.statusText, { color: toneColor }]}>{t(STATUS_KEY[r.status] || 'svcStatusNew')}</Text>
                  </View>
                </View>
                <Text style={styles.requestMessage} numberOfLines={3}>{r.message}</Text>
                {!!r.reply && (
                  <View style={styles.reply}>
                    <Text style={styles.factLabel}>{t('svcBrandReply')}</Text>
                    <Text style={styles.factValue}>{r.reply}</Text>
                  </View>
                )}
                {(r.status === 'new' || r.status === 'accepted') && (
                  <TouchableOpacity style={styles.cancel} onPress={() => cancelRequest(r._id)} accessibilityRole="button">
                    <Text style={styles.cancelText}>{t('svcCancelRequest')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* A Modal, not Alert: Alert does nothing in the web build. */}
      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => !sending && setForm(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialog}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.dialogTitle}>{form ? t(SERVICE_META[form.kind].button) : ''}</Text>
              <Text style={styles.dialogProduct}>{product?.name || ''}</Text>
              <Text style={styles.inputLabel}>{form ? t(SERVICE_META[form.kind].hint) : ''}</Text>
              <TextInput
                style={[styles.input, styles.inputArea]}
                value={message}
                onChangeText={(v) => { setMessage(v); setError(''); }}
                multiline
                maxLength={1500}
                textAlignVertical="top"
                placeholderTextColor={palette.muted}
                accessibilityLabel={form ? t(SERVICE_META[form.kind].hint) : ''}
                editable={!sending}
              />
              <Text style={styles.inputLabel}>{t('svcPhoneOptional')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={60}
                accessibilityLabel={t('svcPhoneOptional')}
                editable={!sending}
              />
              <Text style={styles.dialogHint}>{t('svcContactNote')}</Text>
              {!!error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}
              <View style={styles.dialogActions}>
                <TouchableOpacity style={[styles.linkButton, shape, { flex: 1, justifyContent: 'center' }]} onPress={() => setForm(null)} disabled={sending} accessibilityRole="button">
                  <Text style={styles.linkButtonText}>{t('svcNotNow')}</Text>
                </TouchableOpacity>
                <GradientButton style={[styles.mainButton, shape, { flex: 1, marginTop: 0 }]} from={button.from} to={button.to} onPress={sendRequest} disabled={sending}>
                  {sending ? <ActivityIndicator color={palette.onPrimary} /> : <Text style={styles.mainButtonText}>{t('svcSend')}</Text>}
                </GradientButton>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  empty: { fontSize: 18, color: colors.muted },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  noticeText: { flex: 1, fontSize: 18, color: colors.text },
  service: { paddingVertical: spacing.xs },
  serviceDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH, paddingVertical: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: colors.heading },
  summary: { fontSize: 18, color: colors.muted, marginTop: 1 },
  body: { paddingBottom: spacing.md, gap: spacing.sm },
  fact: { gap: 2 },
  factLabel: { fontSize: 16, color: colors.muted },
  factValue: { fontSize: 18, color: colors.text, lineHeight: 26 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: 6 },
  stepNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNoText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  stepText: { flex: 1, fontSize: 18, color: colors.text, lineHeight: 26 },
  mainButton: { minHeight: MIN_TOUCH, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, marginTop: spacing.xs },
  mainButtonText: { color: colors.onPrimary, fontSize: 19, fontWeight: '700' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  linkButtonText: { fontSize: 18, fontWeight: '600', color: colors.primary },
  request: { paddingVertical: spacing.sm, gap: 6 },
  requestHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  requestTitle: { fontSize: 18, fontWeight: '600', color: colors.heading, flexShrink: 1 },
  status: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  statusText: { fontSize: 15, fontWeight: '700' },
  requestMessage: { fontSize: 17, color: colors.muted },
  reply: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  cancel: { alignSelf: 'flex-start', minHeight: MIN_TOUCH, justifyContent: 'center' },
  cancelText: { fontSize: 17, fontWeight: '600', color: colors.danger },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  dialogTitle: { fontSize: 22, fontWeight: '700', color: colors.heading },
  dialogProduct: { fontSize: 17, color: colors.muted, marginBottom: spacing.md },
  inputLabel: { fontSize: 17, color: colors.text, marginBottom: 6 },
  input: { minHeight: MIN_TOUCH, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 18, color: colors.text, backgroundColor: colors.surface, marginBottom: spacing.md },
  inputArea: { minHeight: 120 },
  dialogHint: { fontSize: 16, color: colors.muted, marginBottom: spacing.md },
  error: { fontSize: 17, color: colors.danger, marginBottom: spacing.md },
  dialogActions: { flexDirection: 'row', gap: spacing.sm },
});
