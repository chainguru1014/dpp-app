import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const fileUrl = (f?: string) => {
  if (!f) return '';
  if (/^https?:\/\//i.test(f)) return f;
  return `${API_BASE_URL}files/${String(f).replace(/^\/+/, '')}`;
};

interface Props {
  visible: boolean;
  notification: any | null;
  user: any;
  onClose: () => void;
  onActionDone?: () => void;
}

export default function NotificationDetailModal({ visible, notification, user, onClose, onActionDone }: Props) {
  const { t } = useI18n();
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [slide, setSlide] = useState(0);

  const isTransfer = notification?.type === 'transfer_request';
  const code = notification?.data?.transferCode;

  useEffect(() => {
    if (!visible) return;
    setResultMsg('');
    setSlide(0);
    setTransfer(null);
    if (isTransfer && code) {
      setLoading(true);
      (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}transfer/${encodeURIComponent(code)}`);
          const data = await res.json();
          if (res.ok && data?.status === 'success') setTransfer(data.data);
        } catch (e) {
          /* fall back to notification.data below */
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [visible, isTransfer, code]);

  const act = async (action: 'confirm' | 'reject') => {
    if (!code || !user?._id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}transfer/${encodeURIComponent(code)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: { kind: 'User', id: String(user._id) } }),
      });
      const data = await res.json();
      if (res.ok && data?.status === 'success') {
        setResultMsg(action === 'confirm' ? t('transferConfirmed') : t('transferRejected'));
        onActionDone?.();
        setTimeout(onClose, 900);
      } else {
        setResultMsg(data?.message || t('serverError'));
      }
    } catch (e) {
      setResultMsg(t('networkErrorRetry'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!notification) return null;

  const d = notification.data || {};
  const status = transfer?.status;
  const isPending = !transfer || status === 'pending';
  const snap = transfer?.productSnapshot || {};
  const buyer = transfer?.to_owner || {};
  const productImage = fileUrl(snap.image || d.productImage);
  const productName = snap.name || d.productName || t('unnamedProduct');
  const brand = snap.brandName || d.brandName || '';
  const qty = transfer?.quantity ?? d.quantity ?? 1;

  const requester = {
    name: buyer.name || d.buyerName || '',
    email: buyer.email || d.buyerEmail || '',
    phone: buyer.phone || d.buyerPhone || '',
    country: buyer.country || d.buyerCountry || '',
    address: d.buyerAddress || '',
  };

  const images: string[] = Array.isArray(notification.images) ? notification.images : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {isTransfer ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              <Text style={styles.heading}>{t('transferConfirmTitle')}</Text>

              {loading ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
              ) : (
                <>
                  <View style={styles.productCard}>
                    {productImage ? (
                      <Image source={{ uri: productImage }} style={styles.productImg} resizeMode="contain" />
                    ) : (
                      <View style={[styles.productImg, styles.imgPlaceholder]}>
                        <Text style={styles.placeholderText}>{t('noImage')}</Text>
                      </View>
                    )}
                    <Text style={styles.productName}>{productName}</Text>
                    {!!brand && <Text style={styles.productBrand}>{brand}</Text>}
                  </View>

                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>{t('transferAmount')}</Text>
                    <Text style={styles.amountValue}>{qty}</Text>
                  </View>

                  <Text style={styles.sectionLabel}>{t('requestedBy')}</Text>
                  <View style={styles.detailBox}>
                    {!!requester.name && <Text style={styles.requesterName}>{requester.name}</Text>}
                    {!!requester.email && <DetailRow label={t('email')} value={requester.email} />}
                    {!!requester.phone && <DetailRow label={t('phoneNumber')} value={requester.phone} />}
                    {!!requester.country && <DetailRow label={t('country')} value={requester.country} />}
                    {!!requester.address && <DetailRow label={t('address')} value={requester.address} />}
                  </View>

                  {!!resultMsg && <Text style={styles.resultMsg}>{resultMsg}</Text>}

                  {isPending && !resultMsg ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.btn, styles.declineBtn]}
                        onPress={() => act('reject')}
                        disabled={submitting}
                      >
                        <Text style={styles.declineText}>{t('decline')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, styles.approveBtn, submitting && { opacity: 0.6 }]}
                        onPress={() => act('confirm')}
                        disabled={submitting}
                      >
                        <Text style={styles.approveText}>{submitting ? '…' : t('approve')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    !resultMsg && <Text style={styles.handledMsg}>{t('transferAlreadyHandled')}</Text>
                  )}
                </>
              )}
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              <Text style={styles.heading}>{notification.title}</Text>

              {images.length > 0 && (
                <View style={styles.sliderWrap}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) =>
                      setSlide(Math.round(e.nativeEvent.contentOffset.x / (e.nativeEvent.layoutMeasurement.width || 1)))
                    }
                  >
                    {images.map((img, i) => (
                      <Image key={i} source={{ uri: fileUrl(img) }} style={styles.slide} resizeMode="cover" />
                    ))}
                  </ScrollView>
                  {images.length > 1 && (
                    <View style={styles.dots}>
                      {images.map((_, i) => (
                        <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {!!notification.message && <Text style={styles.description}>{notification.message}</Text>}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const CARD_W = Math.min(420, SCREEN_W - 32);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: {
    width: CARD_W,
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadow(3),
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 15, color: colors.muted, fontWeight: '700' },
  body: { padding: spacing.xl, paddingTop: spacing.xxl },
  heading: { fontSize: 17, fontWeight: '800', color: colors.heading, marginBottom: spacing.lg, paddingHorizontal: 28, textAlign: 'center' },
  productCard: { alignItems: 'center', marginBottom: spacing.lg },
  productImg: { width: 150, height: 180, borderRadius: radius.md, backgroundColor: '#fff' },
  imgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  placeholderText: { color: colors.muted, fontSize: 12 },
  productName: { fontSize: 16, fontWeight: '800', color: colors.heading, marginTop: spacing.md, textAlign: 'center' },
  productBrand: { fontSize: 13, color: colors.muted, marginTop: 2, textAlign: 'center' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  amountLabel: { fontSize: 14, color: colors.primaryDark, fontWeight: '600' },
  amountValue: { fontSize: 18, color: colors.accent, fontWeight: '800' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginBottom: spacing.sm },
  detailBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  requesterName: { fontSize: 14, fontWeight: '800', color: colors.heading, paddingVertical: spacing.sm },
  detailRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  detailLabel: { width: 92, fontSize: 13, color: colors.muted, fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 13, color: colors.text },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  declineText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  approveBtn: { backgroundColor: colors.accent, ...shadow(1) },
  approveText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  resultMsg: { textAlign: 'center', color: colors.primary, fontSize: 14, fontWeight: '700', marginVertical: spacing.md },
  handledMsg: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  sliderWrap: { marginBottom: spacing.lg },
  slide: { width: CARD_W - spacing.xl * 2, height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 3 },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  description: { fontSize: 14, color: colors.text, lineHeight: 21, textAlign: 'center' },
});
