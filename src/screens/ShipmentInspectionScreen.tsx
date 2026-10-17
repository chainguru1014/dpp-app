import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import WebCodeScanner from '../components/WebCodeScanner';
import CaptureCameraView, { isCaptureCameraAvailable } from '../components/CaptureCameraView';
import { requestNativeCameraPermission } from '../components/NativeCodeScanner';
import ScanFrameCorners from '../components/ScanFrameCorners';
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
  const [torchOn, setTorchOn] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
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
        // Mirrors ScannerScreen's own camera overlay layout exactly: frame
        // corners, a top hint pill, a flash/help corner row, and a single
        // bottom pill — same positions and styles, just one action
        // ("Enter manually") instead of that screen's two.
        <View style={styles.cameraScreen}>
          <View style={styles.cameraViewport}>
            <View style={styles.cameraFill}>
              {hasCameraPermission === null ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : Platform.OS === 'web' ? (
                <WebCodeScanner active onScan={(value) => handleCameraScan(value)} />
              ) : isCaptureCameraAvailable() ? (
                <CaptureCameraView active onScan={(value) => handleCameraScan(value)} torch={torchOn} />
              ) : (
                <Text style={styles.scannerUnavailableTextDark}>{t('cameraNotAvailableBrowser')}</Text>
              )}
            </View>
            {lookupLoading && (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View pointerEvents="none" style={styles.frameOverlay}>
              <ScanFrameCorners size={240} />
            </View>
            <View pointerEvents="none" style={styles.overlayHintWrap}>
              <VectorIcon name="qr-code" size={16} color="#fff" style={styles.overlayHintIcon} />
              <Text style={styles.overlayHintText}>{t('shipmentInspectionScanHint')}</Text>
            </View>
            <View style={styles.overlayCornerRow}>
              <TouchableOpacity
                style={styles.overlayCornerButton}
                onPress={() => setTorchOn((v) => !v)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('scanFlash')}
                accessibilityState={{ selected: torchOn }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <VectorIcon name={torchOn ? 'flash-on' : 'flash-off'} size={20} color="#fff" />
                <Text style={styles.overlayCornerText}>{t('scanFlash')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.overlayCornerButton}
                onPress={() => setHelpVisible(true)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('scanHelpLabel')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <VectorIcon name="help-outline" size={20} color="#fff" />
                <Text style={styles.overlayCornerText}>{t('scanHelpLabel')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.overlayActionRow}>
              <TouchableOpacity
                style={styles.overlayActionBtn}
                onPress={() => setManualEntryMode(true)}
                activeOpacity={0.85}
              >
                <VectorIcon name="keyboard" size={18} color={colors.primary} />
                <Text style={styles.overlayActionText}>{t('shipmentInspectionEnterManually')}</Text>
              </TouchableOpacity>
            </View>
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

      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <TouchableOpacity style={styles.helpOverlay} activeOpacity={1} onPress={() => setHelpVisible(false)}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>{t('shipmentInspectionTitle')}</Text>
            <Text style={styles.helpBody}>{t('shipmentInspectionHelpBody')}</Text>
            <GradientButton style={styles.helpCloseButton} onPress={() => setHelpVisible(false)} activeOpacity={0.8}>
              <Text style={styles.helpCloseButtonText}>{t('close')}</Text>
            </GradientButton>
          </View>
        </TouchableOpacity>
      </Modal>
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
  // GradientButton skips painting its gradient entirely while disabled
  // (see that component's own comment), falling back to whatever flat
  // backgroundColor this style sets — opacity alone left it with no
  // background at all, nearly-white text on the page's own light
  // background. Same solid muted fill CorporateScannerScreen's own
  // captureButtonDisabled uses.
  primaryButtonDisabled: { backgroundColor: colors.borderStrong },
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
  // Overlay elements — same positions/styles as ScannerScreen's own
  // renderCameraOverlay(), just one action in overlayActionRow instead of
  // two (Upload Image doesn't apply here).
  frameOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  overlayHintWrap: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayHintIcon: {
    marginRight: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayHintText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayCornerRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 154,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  overlayCornerButton: {
    alignItems: 'center',
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  overlayCornerText: {
    color: '#fff',
    fontSize: 17,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayActionRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 96,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  overlayActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  overlayActionText: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  helpCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow(3),
  },
  helpTitle: { fontSize: 26, fontWeight: '700', color: colors.heading, marginBottom: spacing.sm },
  helpBody: { fontSize: 21, color: colors.text, lineHeight: 28, marginBottom: spacing.lg },
  helpCloseButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  helpCloseButtonText: { color: '#fff', fontSize: 21, fontWeight: '700' },
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
