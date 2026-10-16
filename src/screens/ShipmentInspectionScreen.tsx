import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
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
  product_id: { _id: string; name: string } | string;
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

  // Step 2 — gate scan
  const [gateState, setGateState] = useState<GateState>('idle');
  const [gateError, setGateError] = useState('');
  const scannedEpcsRef = useRef<Set<string>>(new Set());
  const [scannedCount, setScannedCount] = useState(0);
  const pollIntervalRef = useRef<any>(null);
  const pollInFlightRef = useRef(false);

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

  const handleLookup = async () => {
    const code = codeInput.trim();
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

  const resetToLookup = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    stopImpinjReading().catch(() => {});
    scannedEpcsRef.current = new Set();
    setScannedCount(0);
    setGateState('idle');
    setGateError('');
    setManifest(null);
    setResult(null);
    setCodeInput('');
    setStep('lookup');
  };

  const handleStartGateScan = async () => {
    setGateError('');
    setGateState('connecting');
    scannedEpcsRef.current = new Set();
    setScannedCount(0);
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
          if (added) setScannedCount(scannedEpcsRef.current.size);
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
    setResult(null);
    setGateState('idle');
    setGateError('');
    setStep('gateScan');
  };

  const productName = manifest && typeof manifest.product_id === 'object' ? manifest.product_id.name : '';

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('shipmentInspectionTitle')}</Text>

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
                onSubmitEditing={handleLookup}
              />
            </View>
            {!!lookupError && <Text style={styles.errorText}>{lookupError}</Text>}
            <GradientButton
              style={[styles.primaryButton, (!codeInput.trim() || lookupLoading) && styles.primaryButtonDisabled]}
              onPress={handleLookup}
              disabled={!codeInput.trim() || lookupLoading}
            >
              {lookupLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('shipmentInspectionLookupButton')}</Text>}
            </GradientButton>
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
                <View style={styles.scanningBox}>
                  <VectorIcon name="wifi-tethering" size={40} color={colors.primary} />
                  <Text style={styles.scanningCount}>{scannedCount}</Text>
                  <Text style={styles.scanningLabel}>{t('shipmentInspectionTagsDetected')}</Text>
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
