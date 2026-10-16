import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import WebCodeScanner from '../components/WebCodeScanner';
import CaptureCameraView, { isCaptureCameraAvailable } from '../components/CaptureCameraView';
import { requestNativeCameraPermission } from '../components/NativeCodeScanner';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';
import {
  connectImpinjReader,
  startImpinjReading,
  stopImpinjReading,
  getImpinjReaderStatus,
  getImpinjTagsInView,
} from '../native/impinjRfid';

// Warehouse gate-inspection flow: scan/enter a shipment manifest's code ->
// run the RFID gate scan (Impinj R700 only — this is what the CEO's brief
// specifically names) -> compare against the manifest's expected items ->
// show a clear pass/fail result. Deliberately a separate screen from
// CorporateScannerScreen rather than another capture-type tab: this is a
// guided multi-step session (manifest -> scan -> result), not a continuous
// scan-and-capture loop.

const GATE_POLL_MS = 1200;

interface ManifestDto {
  _id: string;
  manifest_code: string;
  label: string;
  status: 'pending' | 'complete' | 'mismatch';
  expected_qrcode_ids: number[];
  product_id: { _id: string; name: string; color?: string; size?: string } | string;
}

interface InspectionResultDto {
  manifest: ManifestDto;
  inspection: {
    result: 'pass' | 'fail';
    matched_qrcode_ids: number[];
    missing_qrcode_ids: number[];
    unexpected_epcs: string[];
  };
}

interface MatchPreviewDto {
  matchedQrcodeIds: number[];
  missingQrcodeIds: number[];
  unexpectedEpcs: string[];
  result: 'pass' | 'fail';
}

type Step = 'lookup' | 'gateScan' | 'result';
type GateState = 'idle' | 'connecting' | 'scanning' | 'finishing' | 'failed';

export default function ShipmentInspectionScreen({ navigation, user, onLogout }: any) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('lookup');

  // Step 1 — lookup
  const [codeInput, setCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [manifest, setManifest] = useState<ManifestDto | null>(null);
  // "Standard barcode scanner" per the brief — camera scan is the primary
  // path, with the text field underneath as a fallback (barcode scanner
  // hardware on a warehouse device usually just types into focused input
  // anyway, so the field stays useful either way).
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerPermissionDenied, setScannerPermissionDenied] = useState(false);
  const scannerHandledRef = useRef(false);

  // Step 2 — gate scan
  const [gateState, setGateState] = useState<GateState>('idle');
  const [gateError, setGateError] = useState('');
  const scannedEpcsRef = useRef<Set<string>>(new Set());
  const [scannedCount, setScannedCount] = useState(0);
  const pollIntervalRef = useRef<any>(null);
  const pollInFlightRef = useRef(false);
  // Live "Real-Time Matching" preview (Step 3 of the brief, shown while the
  // scan is still running, not just after Finish Scan) — recomputed via the
  // read-only /preview-match endpoint whenever a new tag is seen.
  const [previewMatched, setPreviewMatched] = useState(0);
  const previewInFlightRef = useRef(false);

  // Step 3 — result
  const [result, setResult] = useState<InspectionResultDto | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      stopImpinjReading().catch(() => {});
    };
  }, []);

  const authHeader = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const handleLookup = async (overrideCode?: string) => {
    const code = (overrideCode ?? codeInput).trim();
    if (!code || lookupLoading) return;
    setLookupLoading(true);
    setLookupError('');
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_BASE_URL}shipment-manifest/code/${encodeURIComponent(code)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.message || t('shipmentManifestNotFound'));
      }
      setManifest(data.data);
      setStep('gateScan');
    } catch (err: any) {
      setLookupError(err?.message || t('shipmentManifestNotFound'));
    } finally {
      setLookupLoading(false);
    }
  };

  const openScanner = async () => {
    setScannerPermissionDenied(false);
    if (Platform.OS !== 'web') {
      const granted = await requestNativeCameraPermission();
      if (!granted) {
        setScannerPermissionDenied(true);
        return;
      }
    }
    scannerHandledRef.current = false;
    setScannerActive(true);
  };

  const handleCameraScan = (value: string) => {
    // CaptureCameraView/WebCodeScanner can fire onScan for several frames in
    // a row before `active` actually flips off — guard so only the first
    // detected code triggers the lookup.
    if (scannerHandledRef.current) return;
    scannerHandledRef.current = true;
    setScannerActive(false);
    setCodeInput(value);
    handleLookup(value);
  };

  const resetToLookup = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    stopImpinjReading().catch(() => {});
    scannedEpcsRef.current = new Set();
    setScannedCount(0);
    setPreviewMatched(0);
    setGateState('idle');
    setGateError('');
    setManifest(null);
    setResult(null);
    setCodeInput('');
    setStep('lookup');
  };

  const previewMatch = async () => {
    if (!manifest || previewInFlightRef.current) return;
    previewInFlightRef.current = true;
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_BASE_URL}shipment-manifest/${manifest._id}/preview-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify({ scanned_epcs: [...scannedEpcsRef.current] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.status === 'success') {
        const preview: MatchPreviewDto = data.data;
        setPreviewMatched(preview.matchedQrcodeIds.length);
      }
    } catch (err) {
      // Live preview is best-effort UI feedback — a failed tick just tries
      // again next time scannedCount changes; Finish Scan's real /inspect
      // call is the one that actually has to succeed.
    } finally {
      previewInFlightRef.current = false;
    }
  };

  const handleStartGateScan = async () => {
    setGateError('');
    setGateState('connecting');
    scannedEpcsRef.current = new Set();
    setScannedCount(0);
    setPreviewMatched(0);
    try {
      let status = await getImpinjReaderStatus();
      if (!status.isConnected) {
        status = await connectImpinjReader();
      }
      if (!status.isConnected) {
        throw new Error(status.lastError || t('rfidConnectFailed'));
      }
      await startImpinjReading();
      setGateState('scanning');

      const poll = async () => {
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;
        try {
          const tags = await getImpinjTagsInView();
          let added = false;
          for (const tag of tags) {
            if (tag.epc && !scannedEpcsRef.current.has(tag.epc)) {
              scannedEpcsRef.current.add(tag.epc);
              added = true;
            }
          }
          if (added) {
            setScannedCount(scannedEpcsRef.current.size);
            previewMatch();
          }
        } catch (err) {
          // A transient poll failure mid-session isn't fatal — the next
          // tick tries again; only Finish Scan's own errors stop things.
        } finally {
          pollInFlightRef.current = false;
        }
      };
      poll();
      pollIntervalRef.current = setInterval(poll, GATE_POLL_MS);
    } catch (err: any) {
      setGateState('failed');
      setGateError(err?.message || t('rfidConnectFailed'));
    }
  };

  const handleFinishGateScan = async () => {
    if (!manifest) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setGateState('finishing');
    try {
      await stopImpinjReading().catch(() => {});
      const headers = await authHeader();
      const res = await fetch(`${API_BASE_URL}shipment-manifest/${manifest._id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify({ scanned_epcs: [...scannedEpcsRef.current] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.message || t('shipmentInspectFailed'));
      }
      setResult(data.data);
      setStep('result');
    } catch (err: any) {
      setGateState('failed');
      setGateError(err?.message || t('shipmentInspectFailed'));
    }
  };

  const handleRescan = () => {
    scannedEpcsRef.current = new Set();
    setScannedCount(0);
    setPreviewMatched(0);
    setResult(null);
    setGateState('idle');
    setGateError('');
    setStep('gateScan');
  };

  const productInfo = manifest && typeof manifest.product_id === 'object' ? manifest.product_id : null;
  const productName = productInfo?.name || '';
  // "(Jeans Size L)" style detail per the brief — same for every missing
  // item since a manifest is scoped to one product, so it's shown once
  // alongside the item numbers rather than repeated per item.
  const productVariantDetail = [productInfo?.color, productInfo?.size].filter(Boolean).join(' ');

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('shipmentInspectionTitle')}</Text>

        {step === 'lookup' && (
          <>
            <Text style={styles.prompt}>{t('shipmentInspectionLookupPrompt')}</Text>

            <TouchableOpacity style={styles.scanQrButton} onPress={openScanner} activeOpacity={0.85}>
              <VectorIcon name="qr-code-scanner" size={22} color="#fff" />
              <Text style={styles.primaryButtonText}>{t('shipmentInspectionScanQr')}</Text>
            </TouchableOpacity>
            {scannerPermissionDenied && <Text style={styles.errorText}>{t('cameraPermissionDenied')}</Text>}

            <Text style={styles.orDivider}>{t('shipmentInspectionOrEnterManually')}</Text>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={codeInput}
                onChangeText={(v) => {
                  setCodeInput(v);
                  if (lookupError) setLookupError('');
                }}
                placeholder="SHIP-XXXXXXXXXX"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!lookupLoading}
                onSubmitEditing={() => handleLookup()}
              />
            </View>
            {!!lookupError && <Text style={styles.errorText}>{lookupError}</Text>}
            <GradientButton
              style={[styles.primaryButton, (!codeInput.trim() || lookupLoading) && styles.primaryButtonDisabled]}
              onPress={() => handleLookup()}
              disabled={!codeInput.trim() || lookupLoading}
            >
              {lookupLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('shipmentInspectionLookupButton')}</Text>}
            </GradientButton>

            <Modal visible={scannerActive} animationType="slide" onRequestClose={() => setScannerActive(false)}>
              <View style={styles.scannerModal}>
                <View style={styles.scannerHeader}>
                  <TouchableOpacity
                    onPress={() => setScannerActive(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <VectorIcon name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.scannerHeaderText}>{t('shipmentInspectionScanQr')}</Text>
                  <View style={{ width: 28 }} />
                </View>
                <View style={styles.scannerViewport}>
                  {Platform.OS === 'web' ? (
                    <WebCodeScanner active={scannerActive} onScan={(value) => handleCameraScan(value)} />
                  ) : isCaptureCameraAvailable() ? (
                    <CaptureCameraView active={scannerActive} onScan={(value) => handleCameraScan(value)} />
                  ) : (
                    <Text style={styles.scannerUnavailableText}>{t('cameraNotAvailableBrowser')}</Text>
                  )}
                </View>
              </View>
            </Modal>
          </>
        )}

        {step === 'gateScan' && manifest && (
          <>
            <View style={styles.manifestCard}>
              <Text style={styles.manifestCode}>{manifest.manifest_code}</Text>
              {!!manifest.label && <Text style={styles.manifestLabel}>{manifest.label}</Text>}
              {!!productName && <Text style={styles.manifestProduct}>{productName}</Text>}
              <Text style={styles.manifestCount}>
                {t('shipmentInspectionExpectedItemsLabel')}: {manifest.expected_qrcode_ids.length}
              </Text>
            </View>

            {gateState === 'idle' && (
              <GradientButton style={styles.primaryButton} onPress={handleStartGateScan}>
                <VectorIcon name="sensors" size={22} color="#fff" style={{ marginRight: spacing.sm }} />
                <Text style={styles.primaryButtonText}>{t('shipmentInspectionStartGateScan')}</Text>
              </GradientButton>
            )}

            {gateState === 'connecting' && (
              <View style={styles.statusBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.statusText}>{t('rfidConnectButton')}…</Text>
              </View>
            )}

            {gateState === 'scanning' && (
              <>
                {/* Real-Time Matching (Step 3 of the brief, shown live as
                    tags come in, not just after Finish Scan) — matched vs.
                    expected count, turning green the moment every expected
                    item has been seen. */}
                <View style={[
                  styles.scanningBox,
                  previewMatched > 0 && previewMatched === manifest.expected_qrcode_ids.length && styles.scanningBoxComplete,
                ]}>
                  <VectorIcon
                    name="wifi-tethering"
                    size={40}
                    color={previewMatched === manifest.expected_qrcode_ids.length && previewMatched > 0 ? '#fff' : colors.primary}
                  />
                  <Text style={[
                    styles.scanningCount,
                    previewMatched === manifest.expected_qrcode_ids.length && previewMatched > 0 && styles.scanningCountComplete,
                  ]}>
                    {previewMatched} / {manifest.expected_qrcode_ids.length}
                  </Text>
                  <Text style={[
                    styles.scanningLabel,
                    previewMatched === manifest.expected_qrcode_ids.length && previewMatched > 0 && styles.scanningLabelComplete,
                  ]}>
                    {t('shipmentInspectionExpectedItemsLabel')}
                  </Text>
                  <Text style={[
                    styles.scanningSubtext,
                    previewMatched === manifest.expected_qrcode_ids.length && previewMatched > 0 && styles.scanningLabelComplete,
                  ]}>
                    {scannedCount} {t('shipmentInspectionTagsDetected')}
                  </Text>
                </View>
                <GradientButton style={styles.primaryButton} onPress={handleFinishGateScan}>
                  <Text style={styles.primaryButtonText}>{t('shipmentInspectionFinishGateScan')}</Text>
                </GradientButton>
              </>
            )}

            {gateState === 'finishing' && (
              <View style={styles.statusBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.statusText}>{t('shipmentInspectionSubmitting')}</Text>
              </View>
            )}

            {gateState === 'failed' && (
              <>
                <Text style={styles.errorText}>{gateError}</Text>
                <GradientButton style={styles.primaryButton} onPress={handleStartGateScan}>
                  <Text style={styles.primaryButtonText}>{t('tryAgain')}</Text>
                </GradientButton>
              </>
            )}

            <TouchableOpacity style={styles.linkButton} onPress={resetToLookup}>
              <Text style={styles.linkButtonText}>{t('shipmentInspectionScanDifferentManifest')}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'result' && result && (
          <>
            <View style={[styles.resultCard, result.inspection.result === 'pass' ? styles.resultCardPass : styles.resultCardFail]}>
              <VectorIcon
                name={result.inspection.result === 'pass' ? 'check-circle' : 'error'}
                size={56}
                color="#fff"
              />
              <Text style={styles.resultTitle}>
                {result.inspection.result === 'pass' ? t('shipmentInspectionComplete') : t('shipmentInspectionMismatch')}
              </Text>
              {result.inspection.result === 'fail' && result.inspection.missing_qrcode_ids.length > 0 && (
                <Text style={styles.resultMissing}>
                  {t('shipmentInspectionMissingLabel')}: {result.inspection.missing_qrcode_ids.map((id) => `#${id}`).join(', ')}
                  {!!productName && ` (${[productName, productVariantDetail].filter(Boolean).join(', ')})`}
                </Text>
              )}
              {result.inspection.unexpected_epcs.length > 0 && (
                <Text style={styles.resultUnexpected}>
                  {t('shipmentInspectionUnexpectedLabel')}: {result.inspection.unexpected_epcs.length}
                </Text>
              )}
            </View>

            {result.inspection.result === 'fail' && (
              <GradientButton style={styles.primaryButton} onPress={handleRescan}>
                <Text style={styles.primaryButtonText}>{t('shipmentInspectionRescan')}</Text>
              </GradientButton>
            )}
            <TouchableOpacity style={styles.linkButton} onPress={resetToLookup}>
              <Text style={styles.linkButtonText}>{t('shipmentInspectionDone')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { fontSize: 24, fontWeight: '700', color: colors.heading, marginBottom: spacing.md },
  prompt: { fontSize: 19, color: colors.muted, marginBottom: spacing.lg },
  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 54,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  input: { fontSize: 20, color: colors.text, fontWeight: '600' },
  errorText: { color: colors.danger, fontSize: 17, marginBottom: spacing.md },
  primaryButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  linkButton: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  linkButtonText: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  manifestCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  manifestCode: { fontSize: 18, fontWeight: '700', color: colors.heading, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo' },
  manifestLabel: { fontSize: 18, color: colors.text, marginTop: spacing.xs },
  manifestProduct: { fontSize: 18, color: colors.text, marginTop: spacing.xs },
  manifestCount: { fontSize: 17, color: colors.muted, marginTop: spacing.sm },
  statusBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  statusText: { fontSize: 18, color: colors.muted },
  scanningBox: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  scanningCount: { fontSize: 44, fontWeight: '700', color: colors.primary },
  scanningLabel: { fontSize: 17, color: colors.muted },
  scanningSubtext: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  scanningBoxComplete: { backgroundColor: colors.success },
  scanningCountComplete: { color: '#fff' },
  scanningLabelComplete: { color: '#fff' },
  scanQrButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.headerLight,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  orDivider: { fontSize: 15, color: colors.muted, textAlign: 'center', marginVertical: spacing.md },
  scannerModal: { flex: 1, backgroundColor: '#000' },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  scannerHeaderText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  scannerViewport: { flex: 1 },
  scannerUnavailableText: { color: '#fff', fontSize: 17, textAlign: 'center', marginTop: spacing.xxl },
  resultCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadow(2),
  },
  resultCardPass: { backgroundColor: colors.success },
  resultCardFail: { backgroundColor: colors.danger },
  resultTitle: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center' },
  resultMissing: { fontSize: 18, color: '#fff', textAlign: 'center', marginTop: spacing.xs },
  resultUnexpected: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: spacing.xs },
});
