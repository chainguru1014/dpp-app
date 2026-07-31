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
  TextInput,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';
import WebCodeScanner, { WebCodeScannerHandle } from '../components/WebCodeScanner';
import CaptureCameraView, { CaptureCameraHandle, isCaptureCameraAvailable, CapturedCodeFormat } from '../components/CaptureCameraView';
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
  const [liveCode, setLiveCode] = useState<{ value: string; format: CapturedCodeFormat } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const tokenRef = useRef<string>('');
  const lastSeenAtRef = useRef<number>(0);
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
  // the Capture button disables again once the code leaves the frame.
  useEffect(() => {
    livenessIntervalRef.current = setInterval(() => {
      if (liveCode && Date.now() - lastSeenAtRef.current > LIVENESS_TIMEOUT_MS) {
        setLiveCode(null);
      }
    }, 200);
    return () => clearInterval(livenessIntervalRef.current);
  }, [liveCode]);

  const handleScan = (value: string, format: CapturedCodeFormat) => {
    lastSeenAtRef.current = Date.now();
    setLiveCode({ value, format });
  };

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) return;
    lastSeenAtRef.current = Date.now();
    setLiveCode({ value, format: 'barcode' });
    setManualOpen(false);
    setManualValue('');
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
          location: location || undefined,
          device,
        }),
      });

      setLiveCode(null);
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
  const stepNumber = stepIndex + 1;
  const subtitle = step ? `${stepNumber} ${step.entity} / ${step.type}` : `${stepNumber}`;

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
        <CaptureCameraView ref={nativeCameraRef} active={isFocused} onScan={handleScan} />
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
            <Text style={styles.infoLabel}>{t('corpDateLabel')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{dateLabel}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('corpTodayScans')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{captures.length}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('corpCurrentRef')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{currentRef}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t('corpTerminal')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>Terminal {user?.terminalId || '—'}</Text>
          </View>
        </View>

        <View style={styles.scanViewport}>
          {renderCamera()}
          <View pointerEvents="none" style={styles.frameOverlay}>
            <View style={[styles.scanFrame, !!liveCode && styles.scanFrameActive]} />
          </View>
        </View>
        <Text style={styles.hintText}>{t('corpScanHint')}</Text>

        <View style={styles.thumbRow}>
          <Text style={styles.thumbHeading}>{t('corpRecentCaptures')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CorporateReview', { stepIndex })}>
            <Text style={styles.seeAllLink}>{t('corpSeeAll')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
          {captures.map((doc) => (
            <View key={doc._id} style={styles.thumbCard}>
              {!!doc.imagePath && (
                <Image source={{ uri: `${API_BASE_URL.replace(/\/$/, '')}${doc.imagePath}` }} style={styles.thumbImage} />
              )}
              <Text style={styles.thumbRef} numberOfLines={1}>{doc.refNumber}</Text>
              <Text style={styles.thumbTime}>{new Date(doc.capturedAt).toLocaleTimeString()}</Text>
            </View>
          ))}
        </ScrollView>

        {manualOpen && (
          <View style={styles.manualCard}>
            <TextInput
              style={styles.manualInput}
              placeholder={t('corpManualEntryValue')}
              placeholderTextColor={colors.placeholder}
              value={manualValue}
              onChangeText={setManualValue}
            />
            <TouchableOpacity style={styles.manualSubmit} onPress={handleManualSubmit}>
              <Text style={styles.manualSubmitText}>{t('corpManualEntrySubmit')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setManualOpen((v) => !v)}>
            <Text style={styles.secondaryButtonText}>{t('corpManualEntryButton')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CorporateReview', { stepIndex })}>
            <Text style={styles.secondaryButtonText}>{t('corpReviewButton')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.captureButton, (!liveCode || capturing) && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={!liveCode || capturing}
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.captureButtonText}>{t('corpCaptureButton')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </AppLayout>
  );
}

const DARK = '#0b1220';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
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
  infoCell: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  scanViewport: {
    height: 280,
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
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  scanFrameActive: {
    borderColor: colors.primary,
  },
  hintText: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.md },
  thumbRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  thumbHeading: { fontSize: 14, fontWeight: '600', color: colors.heading },
  seeAllLink: { fontSize: 12, color: colors.primary },
  thumbStrip: { marginBottom: spacing.md },
  thumbCard: {
    width: 84,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  thumbImage: { width: '100%', height: 60, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbRef: { fontSize: 10, fontWeight: '600', color: colors.text, marginTop: 4 },
  thumbTime: { fontSize: 9, color: colors.muted },
  manualCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  manualInput: {
    flex: 1,
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  manualSubmit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  manualSubmitText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  captureButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow(1),
  },
  captureButtonDisabled: {
    backgroundColor: colors.borderStrong,
  },
  captureButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
