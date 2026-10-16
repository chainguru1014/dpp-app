import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import WebCodeScanner from '../components/WebCodeScanner';
import CaptureCameraView, { isCaptureCameraAvailable } from '../components/CaptureCameraView';
import { requestNativeCameraPermission } from '../components/NativeCodeScanner';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow, MIN_TOUCH } from '../theme';
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

  // Step 1 — lookup. Mirrors the normal-user scan page's layout
  // (ScannerScreen.tsx): full-screen camera is the default view, with
  // "Enter code manually" as a pill overlaid near the bottom of the camera
  // feed rather than a text field shown up front.
  const [codeInput, setCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [manifest, setManifest] = useState<ManifestDto | null>(null);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerHandledRef = useRef(false);

  useEffect(() => {
    if (step !== 'lookup') return;
    if (Platform.OS === 'web') {
      setHasCameraPermission(true);
      return;
    }
    (async () => {
      const granted = await requestNativeCameraPermission();
      setHasCameraPermission(granted);
      if (!granted) setManualEntryMode(true);
    })();
  }, [step]);

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

  const handleLookup = async (overrideCode?: string): Promise<boolean> => {
    const code = (overrideCode ?? codeInput).trim();
    if (!code || lookupLoading) return false;
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
      return true;
    } catch (err: any) {
      setLookupError(err?.message || t('shipmentManifestNotFound'));
      return false;
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCameraScan = async (value: string) => {
    // CaptureCameraView/WebCodeScanner can fire onScan for several frames in
    // a row before `active` actually flips off — guard so only the first
    // detected code triggers a lookup.
    if (scannerHandledRef.current) return;
    scannerHandledRef.current = true;
    setCodeInput(value);
    const ok = await handleLookup(value);
    if (!ok) {
      // Don't just keep re-scanning the same bad code — surface the error
      // via the manual-entry view so it's actually visible, with a way
      // back to the camera from there.
      setManualEntryMode(true);
      scannerHandledRef.current = false;
    }
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
    setLookupError('');
    setManualEntryMode(hasCameraPermission === false);
    scannerHandledRef.current = false;
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
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.goBack()}
      title={t('shipmentInspectionTitle')}
      flatContent
      flushBottom={step === 'lookup' && !manualEntryMode}
    >
      {step === 'lookup' && !manualEntryMode ? (
        // Default view, matching the normal-user scan page: full-screen
        // camera, with "Enter code manually" as a pill near the bottom
        // instead of a text field shown up front.
        <View style={styles.cameraScreen}>
          <View style={styles.cameraViewport}>
            {/* Fills exactly the viewport's bounds rather than the camera's
                own intrinsic size (same fix ScannerScreen's
                webScannerContainer applies) — without this, the camera on
                web renders at its natural size and pushes everything below
                it (including the bottom pill) out of the visible area. */}
            <View style={styles.cameraFill}>
              {hasCameraPermission === null ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : Platform.OS === 'web' ? (
                <WebCodeScanner active onScan={(value) => handleCameraScan(value)} />
              ) : isCaptureCameraAvailable() ? (
                <CaptureCameraView active onScan={(value) => handleCameraScan(value)} />
              ) : (
                <Text style={styles.scannerUnavailableTextDark}>{t('cameraNotAvailableBrowser')}</Text>
              )}
            </View>
            {lookupLoading && (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View pointerEvents="none" style={styles.cameraHintWrap}>
              <VectorIcon name="qr-code" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.cameraHintText}>{t('shipmentInspectionLookupPrompt')}</Text>
            </View>
          </View>
          {/* Normal flex layout, not an absolutely-positioned overlay on top
              of the camera — sits between the bottom of the camera area and
              the bottom bar, guaranteed visible regardless of whatever the
              camera component itself does internally on web. */}
          <View style={styles.cameraBottomBar}>
            <TouchableOpacity
              style={styles.cameraBottomBtn}
              onPress={() => setManualEntryMode(true)}
              activeOpacity={0.85}
            >
              <VectorIcon name="keyboard" size={18} color={colors.primary} />
              <Text style={styles.cameraBottomBtnText}>{t('shipmentInspectionOrEnterManually')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {step === 'lookup' && (
          <>
            <Text style={styles.prompt}>{t('shipmentInspectionLookupPrompt')}</Text>

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

            {hasCameraPermission === true && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setManualEntryMode(false);
                  setLookupError('');
                  scannerHandledRef.current = false;
                }}
              >
                <Text style={styles.linkButtonText}>{t('shipmentInspectionScanQr')}</Text>
              </TouchableOpacity>
            )}
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
      )}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
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
  // Full-screen camera (default lookup view) — mirrors ScannerScreen's
  // container/scanViewport + bottom action-pill pattern.
  cameraScreen: { flex: 1, backgroundColor: colors.bg },
  cameraViewport: {
    flex: 1,
    minHeight: 180,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#000',
  },
  cameraFill: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerUnavailableTextDark: { color: '#fff', fontSize: 17, textAlign: 'center', marginHorizontal: spacing.xl },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraHintWrap: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  cameraHintText: { color: '#fff', fontSize: 15 },
  cameraBottomBar: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  cameraBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...shadow(2),
  },
  cameraBottomBtnText: { color: colors.primary, fontSize: 18, fontWeight: '700' },
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
