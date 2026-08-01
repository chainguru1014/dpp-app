import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import VectorIcon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';
import WebCodeScanner, { WebCodeScannerHandle } from '../components/WebCodeScanner';
import CaptureCameraView, { CaptureCameraHandle, isCaptureCameraAvailable, CapturedCodeFormat } from '../components/CaptureCameraView';
import ScanFrameCorners from '../components/ScanFrameCorners';
import { getCurrentLocation, getDeviceInfo } from '../utils/deviceCapture';
import { uploadCaptureImage } from '../utils/uploadCapture';

const LIVENESS_TIMEOUT_MS = 700;

interface ProcessStep {
  entity: string;
  type: string;
}

interface CaptureDoc {
  _id: string;
  refNumber: string;
  imagePath: string;
  capturedAt: string;
  productId?: string;
  qrcodeId?: string;
}

interface CorporateScannerScreenProps {
  navigation: any;
  route: any;
  user: any;
  onLogout?: () => void;
}

export default function CorporateScannerScreen({ navigation, route, user, onLogout }: CorporateScannerScreenProps) {
  const { t } = useI18n();
  const isFocused = useIsFocused();
  const stepIndex: number = route?.params?.stepIndex ?? 0;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [step, setStep] = useState<ProcessStep | null>(null);
  const [captures, setCaptures] = useState<CaptureDoc[]>([]);
  const [liveCode, setLiveCode] = useState<{ value: string; format: CapturedCodeFormat; manual?: boolean; productId?: string; qrcodeId?: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeUnrecognized, setCodeUnrecognized] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  const tokenRef = useRef<string>('');
  const lastSeenAtRef = useRef<number>(0);
  const lastCheckedValueRef = useRef<string>('');
  const livenessIntervalRef = useRef<any>(null);
  const nativeCameraRef = useRef<CaptureCameraHandle>(null);
  const webScannerRef = useRef<WebCodeScannerHandle>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: t('cameraPermissionTitle'),
              message: t('cameraPermissionMessage'),
              buttonNeutral: t('askMeLater'),
              buttonNegative: t('cancel'),
              buttonPositive: t('ok'),
            }
          );
          setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        } catch (err) {
          console.warn(err);
          setHasPermission(false);
        }
        // Best-effort — GPS is optional per capture, never blocks scanning.
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        } catch (err) {
          console.warn(err);
        }
      } else {
        setHasPermission(true);
      }
    })();
  }, []);

  const loadStep = async () => {
    const token = await AsyncStorage.getItem('userToken');
    tokenRef.current = token || '';
    try {
      const res = await fetch(`${API_BASE_URL}company/process-steps`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      const steps: ProcessStep[] = data?.data?.processSteps || [];
      setStep(steps[stepIndex] || null);
    } catch (err) {
      console.error('Failed to load process step:', err);
    }
  };

  const loadCaptures = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}captures?stepIndex=${stepIndex}&date=today`, {
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      setCaptures(data?.data?.docs || []);
    } catch (err) {
      console.error('Failed to load captures:', err);
    }
  };

  useEffect(() => {
    (async () => {
      await loadStep();
      await loadCaptures();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Liveness: clears liveCode after LIVENESS_TIMEOUT_MS of no detection, so
  // the Capture button disables again once the code leaves the frame. Also
  // resets lastCheckedValueRef so the same code re-entering the frame later
  // gets re-verified rather than silently skipped.
  useEffect(() => {
    livenessIntervalRef.current = setInterval(() => {
      // Manual entry has no camera frame continuously refreshing
      // lastSeenAtRef — it stays enabled until captured or replaced, not on
      // a liveness timer.
      if (liveCode && !liveCode.manual && Date.now() - lastSeenAtRef.current > LIVENESS_TIMEOUT_MS) {
        setLiveCode(null);
        setCodeUnrecognized(false);
        lastCheckedValueRef.current = '';
      }
    }, 200);
    return () => clearInterval(livenessIntervalRef.current);
  }, [liveCode]);

  // Only a code that resolves to one of our own registered products (a valid
  // security/encrypted QR, a GS1 Digital Link, or a barcode already mapped
  // via the admin's identifier registry — the same resolution paths the
  // consumer ScannerScreen uses) is allowed to enable the Capture button.
  // An unrecognized code in frame leaves the button disabled. Also returns
  // the resolved product/qrcode id (when the response carries one) so
  // handleCapture can snapshot it onto the CaptureRecord — that's what lets
  // a recent-capture thumbnail navigate straight to the product's detail page.
  const verifyScannedCode = async (value: string, format: CapturedCodeFormat): Promise<{ recognized: boolean; productId?: string; qrcodeId?: string }> => {
    try {
      const extractIds = (productData: any) => ({
        recognized: true,
        productId: productData?._id ? String(productData._id) : undefined,
        qrcodeId: productData?.token_id != null ? String(productData.token_id) : undefined,
      });

      if (format === 'qr') {
        const productUrlMatch = value.match(/\/product\/([^/?#]+)\/([^/?#]+)/i);
        let res: Response;
        let data: any;
        if (productUrlMatch) {
          res = await fetch(`${API_BASE_URL}qrcode/resolve-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrUrl: value }),
          });
          data = await res.json().catch(() => ({}));
        } else {
          let encryptData = value;
          if (encryptData.includes('qrcode=')) {
            const [rawParam] = encryptData.split('qrcode=').slice(1);
            encryptData = rawParam?.split('&')[0] || '';
          }
          res = await fetch(`${API_BASE_URL}qrcode/decrypt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptData }),
          });
          data = await res.json().catch(() => ({}));
        }
        if (res.ok && data.status === 'success') return extractIds(data.data);

        // Not one of our own QR formats — maybe a GS1 Digital Link.
        const gs1Res = await fetch(`${API_BASE_URL}pmc/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_type: 'gs1dl', raw_value: value }),
        });
        const gs1Data = await gs1Res.json().catch(() => ({}));
        if (gs1Res.ok && gs1Data.status === 'success') return extractIds(gs1Data.data);
        return { recognized: false };
      }

      const res = await fetch(`${API_BASE_URL}pmc/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'barcode', raw_value: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success') return extractIds(data.data);
      return { recognized: false };
    } catch (err) {
      console.error('verifyScannedCode failed:', err);
      return { recognized: false };
    }
  };

  const handleScan = (value: string, format: CapturedCodeFormat, manual = false) => {
    lastSeenAtRef.current = Date.now();
    if (value === lastCheckedValueRef.current) return;
    lastCheckedValueRef.current = value;
    setVerifying(true);
    verifyScannedCode(value, format).then(({ recognized, productId, qrcodeId }) => {
      if (lastCheckedValueRef.current !== value) return; // stale result — a different code is now in frame
      setVerifying(false);
      setCodeUnrecognized(!recognized);
      setLiveCode(recognized ? { value, format, manual, productId, qrcodeId } : null);
    });
  };

  const handleCapture = async () => {
    if (!liveCode || capturing) return;
    setCapturing(true);
    try {
      let photoUri: string | null = null;
      if (Platform.OS === 'web') {
        photoUri = webScannerRef.current?.captureFrame() || null;
      } else {
        photoUri = (await nativeCameraRef.current?.takePhoto()) || null;
      }

      const [imagePath, location, device] = await Promise.all([
        photoUri ? uploadCaptureImage(photoUri) : Promise.resolve(null),
        getCurrentLocation(),
        getDeviceInfo(),
      ]);

      await fetch(`${API_BASE_URL}captures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
        body: JSON.stringify({
          stepIndex,
          rawValue: liveCode.value,
          identifierType: liveCode.format,
          imagePath: imagePath || '',
          productId: liveCode.productId,
          qrcodeId: liveCode.qrcodeId,
          location: location || undefined,
          device,
        }),
      });

      // Deliberately NOT clearing liveCode here — continuous capture: as long
      // as the same registered code stays in frame, Capture should stay
      // enabled for the next press rather than requiring the code to leave
      // and re-enter the frame first. It still clears via the liveness timer
      // once the code actually leaves frame, or updates immediately once a
      // different code is detected.
      await loadCaptures();
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setCapturing(false);
    }
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString();
  const currentRef = captures[0]?.refNumber || '—';
  const subtitle = step ? `${step.entity} / ${step.type}` : undefined;

  const renderCamera = () => {
    if (hasPermission === null) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }
    if (hasPermission === false) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{t('cameraPermissionDenied')}</Text>
        </View>
      );
    }
    if (Platform.OS === 'web') {
      return (
        <WebCodeScanner ref={webScannerRef} active={isFocused} onScan={handleScan} mode="continuous" />
      );
    }
    if (isCaptureCameraAvailable()) {
      return (
        <CaptureCameraView ref={nativeCameraRef} active={isFocused} onScan={handleScan} torch={torchOn} />
      );
    }
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>{t('cameraNotAvailableBrowser')}</Text>
      </View>
    );
  };

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      title={t('scanOperationTitle')}
      subtitle={subtitle}
    >
      <View style={styles.container}>
        <View style={styles.infoStrip}>
          <View style={styles.infoCell}>
            <VectorIcon name="event" size={14} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpDateLabel')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{dateLabel}</Text>
          </View>
          <View style={styles.infoCell}>
            <VectorIcon name="show-chart" size={14} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpTodayScans')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{captures.length}</Text>
          </View>
          <View style={styles.infoCell}>
            <VectorIcon name="description" size={14} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpCurrentRef')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{currentRef}</Text>
          </View>
          <View style={styles.infoCell}>
            <VectorIcon name="person" size={14} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpTerminal')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>Terminal {user?.terminalId || '—'}</Text>
          </View>
        </View>

        <View style={styles.scanViewport}>
          {renderCamera()}
          <View pointerEvents="none" style={styles.frameOverlay}>
            <ScanFrameCorners size={240} active={!!liveCode} activeColor={colors.primary} />
          </View>
          <View pointerEvents="none" style={styles.overlayHintWrap}>
            <VectorIcon name="qr-code" size={16} color="#fff" style={styles.overlayHintIcon} />
            <Text style={styles.overlayHintText}>{t('corpScanHint')}</Text>
          </View>
          <View style={styles.overlayCornerRow}>
            <TouchableOpacity style={styles.overlayCornerButton} onPress={() => setTorchOn((v) => !v)} activeOpacity={0.75}>
              <VectorIcon name={torchOn ? 'flash-on' : 'flash-off'} size={20} color="#fff" />
              <Text style={styles.overlayCornerText}>{torchOn ? t('scanTorchOn') : t('scanTorchOff')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overlayCornerButton} onPress={() => setHelpVisible(true)} activeOpacity={0.75}>
              <VectorIcon name="help-outline" size={20} color="#fff" />
              <Text style={styles.overlayCornerText}>{t('scanHelpLabel')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomBoard}>
          <View style={styles.thumbRow}>
            <Text style={styles.thumbHeading}>{t('corpRecentCaptures')}</Text>
            <Text style={styles.seeAllLink}>{t('scanTodayCountLabel').replace('{count}', String(captures.length))}</Text>
          </View>
          {captures.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
              {captures.map((doc, index) => (
                <TouchableOpacity
                  key={doc._id}
                  style={styles.thumbCard}
                  activeOpacity={doc.productId ? 0.7 : 1}
                  disabled={!doc.productId}
                  onPress={() => navigation.navigate('Result', { productId: doc.productId, qrcodeId: doc.qrcodeId })}
                >
                  {!!doc.imagePath && (
                    <Image source={{ uri: `${API_BASE_URL.replace(/\/$/, '')}${doc.imagePath}` }} style={styles.thumbImage} />
                  )}
                  <View style={styles.thumbDetail}>
                    <Text style={styles.thumbIndex}>{index + 1}</Text>
                    <Text style={styles.thumbRef} numberOfLines={1}>{doc.refNumber}</Text>
                    <Text style={styles.thumbTime}>{new Date(doc.capturedAt).toLocaleTimeString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {!!codeUnrecognized && !liveCode && (
            <Text style={styles.unrecognizedText}>{t('corpCodeUnrecognized')}</Text>
          )}

          <TouchableOpacity
            style={[styles.captureButton, (!liveCode || capturing) && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={!liveCode || capturing}
          >
            {capturing || verifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <VectorIcon name="photo-camera" size={16} color="#fff" />
                <Text style={styles.captureButtonText}>{t('corpCaptureButton')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <TouchableOpacity style={styles.helpOverlay} activeOpacity={1} onPress={() => setHelpVisible(false)}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>{t('scannerScanHint')}</Text>
            <Text style={styles.helpBody}>{t('scanHelpBody')}</Text>
            <TouchableOpacity style={styles.helpCloseButton} onPress={() => setHelpVisible(false)} activeOpacity={0.8}>
              <Text style={styles.helpCloseButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </AppLayout>
  );
}

const DARK = '#0b1220';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  // Bleeds past the container's own padding to sit flush against the
  // screen edges/bottom nav with rounded top corners — matches the consumer
  // ScannerScreen's whiteBoard treatment.
  bottomBoard: {
    marginTop: spacing.md,
    marginHorizontal: -spacing.lg,
    marginBottom: -spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  infoStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  infoCell: { flex: 1, alignItems: 'center', gap: 2 },
  infoLabel: { fontSize: 11, color: colors.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  // Camera viewport + overlay — deliberately the same visual treatment as
  // the consumer ScannerScreen's camera (frame size/color, hint pill,
  // torch/help corner buttons) per explicit "same as normal user's camera
  // UI" request. flex:1 (with a floor) so it fills whatever space
  // bottomBoard doesn't need — bottomBoard is content-sized, so this is
  // what keeps it flush against the bottom nav with no gap, matching the
  // consumer ScannerScreen's scanViewport/whiteBoard relationship.
  scanViewport: {
    flex: 1,
    minHeight: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: DARK,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stateBox: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  stateText: { color: '#fff', fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.lg },
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
    fontSize: 13,
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
    bottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  overlayCornerButton: { alignItems: 'center' },
  overlayCornerText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  thumbRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  thumbHeading: { fontSize: 14, fontWeight: '600', color: colors.muted },
  seeAllLink: { fontSize: 12, color: colors.muted },
  // Explicit height — without it a horizontal ScrollView with no flex:1
  // sibling can stretch its single-row content to fill leftover vertical
  // space, ballooning card height when there's only one capture to show.
  // Only rendered at all when there's at least one capture (see JSX) so an
  // empty step doesn't reserve this space between the header and Capture.
  thumbStrip: { height: 70, marginBottom: spacing.md },
  // Horizontal: image on the left, index (dark blue)/ref (gray)/time (gray)
  // stacked on the right.
  thumbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 150,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  thumbImage: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbDetail: { flex: 1, marginLeft: spacing.sm },
  thumbIndex: { fontSize: 13, fontWeight: '700', color: colors.primary },
  thumbRef: { fontSize: 10, fontWeight: '600', color: colors.muted, marginTop: 2 },
  thumbTime: { fontSize: 9, color: colors.muted },
  unrecognizedText: { color: colors.danger, fontSize: 12, textAlign: 'center', marginBottom: spacing.sm },
  captureButton: {
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    ...shadow(1),
  },
  captureButtonDisabled: {
    backgroundColor: colors.borderStrong,
  },
  captureButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  helpTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, marginBottom: spacing.sm },
  helpBody: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: spacing.lg },
  helpCloseButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  helpCloseButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
