import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { useIsFocused } from '@react-navigation/native';
import { colors, radius, spacing, shadow } from '../theme';

// Conditionally import QR scanner based on platform
let QRCodeScanner: any = null;
let RNCamera: any = null;
let QrReader: any = null;

if (Platform.OS !== 'web') {
  try {
    QRCodeScanner = require('react-native-qrcode-scanner').default;
    RNCamera = require('react-native-camera').RNCamera;
  } catch (e) {
    console.warn('Native QR scanner not available:', e);
  }
} else {
  // For web, use react-qr-reader
  try {
    QrReader = require('react-qr-reader');
  } catch (e) {
    console.warn('Web QR reader not available:', e);
  }
}

interface ScannerScreenProps {
  navigation: any;
  route?: any;
  user?: any;
  onLogout?: () => void;
}

export default function ScannerScreen({ navigation, route, user, onLogout }: ScannerScreenProps) {
  const { t } = useI18n();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  // On http (insecure origin) the live camera is unavailable -> use photo scan.
  const [webPhotoMode, setWebPhotoMode] = useState(false);
  const scannerRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isProcessingScanRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastScannedValueRef = useRef<string>('');
  const expectedSecurityQrUrl = String(route?.params?.expectedSecurityQrUrl || '').trim();

  React.useEffect(() => {
    requestCameraPermission();
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isProcessingScanRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isFocused) {
      isProcessingScanRef.current = false;
      setLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isFocused]);

  const normalizeEncryptData = (value: string) => {
    let normalized = value.trim();

    try {
      normalized = decodeURIComponent(normalized);
    } catch (error) {
      // Keep value as-is when QR content is not URI encoded.
    }

    return normalized
      .replace(/\s/g, '+')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'web') {
      // Live camera needs a secure context (https/localhost). When it's not
      // available (e.g. served over http), fall back to scanning from a photo
      // instead of leaving the screen.
      try {
        const hasLiveCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        setWebPhotoMode(!hasLiveCamera);
        setHasPermission(true);
      } catch (err) {
        console.warn(err);
        setWebPhotoMode(true);
        setHasPermission(true);
      }
    } else if (Platform.OS === 'android') {
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
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(t('permissionDeniedTitle'), t('cameraRequiredForQr'));
          navigation.goBack();
        }
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
        navigation.goBack();
      }
    } else {
      // iOS - permissions are handled automatically by the library
      setHasPermission(true);
    }
  };

  // Decode a QR code from a picked/captured image (works over http, no camera
  // stream needed). Uses jsQR on a canvas — web only.
  const decodeImageFromFile = (file: any) => {
    const w: any = globalThis as any;
    setLoading(true);
    try {
      const reader = new w.FileReader();
      reader.onload = () => {
        const img = new w.Image();
        img.onload = () => {
          try {
            const maxDim = 1200;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const cw = Math.max(1, Math.round(img.width * scale));
            const ch = Math.max(1, Math.round(img.height * scale));
            const canvas = w.document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, cw, ch);
            const imageData = ctx.getImageData(0, 0, cw, ch);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const jsQR = require('jsqr').default || require('jsqr');
            const code = jsQR(imageData.data, cw, ch);
            setLoading(false);
            if (code && code.data) {
              handleQRCode(String(code.data));
            } else {
              Alert.alert(t('error'), t('noQrInImage'));
            }
          } catch (err) {
            setLoading(false);
            Alert.alert(t('error'), t('couldNotReadImage'));
          }
        };
        img.onerror = () => {
          setLoading(false);
          Alert.alert(t('error'), t('couldNotLoadImage'));
        };
        img.src = reader.result;
      };
      reader.onerror = () => {
        setLoading(false);
        Alert.alert(t('error'), t('couldNotReadFile'));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      Alert.alert(t('error'), t('photoScanNotSupported'));
    }
  };

  // Open the device camera (mobile) or file picker (desktop) to grab a QR photo.
  const openPhotoScan = () => {
    const w: any = globalThis as any;
    try {
      const input = w.document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment'); // hint: open back camera on mobile
      input.onchange = (ev: any) => {
        const file = ev?.target?.files && ev.target.files[0];
        if (file) decodeImageFromFile(file);
      };
      input.click();
    } catch (err) {
      Alert.alert(t('error'), t('photoScanNotSupported'));
    }
  };

  const handleQRCode = async (e: any) => {
    if (!isFocused || isProcessingScanRef.current) return;
    
    // Handle both native (e.data) and web (e) formats
    const qrData = e.data || e;
    const currentScannedValue = String(qrData || '').trim();
    if (!currentScannedValue) return;

    if (lastScannedValueRef.current === currentScannedValue) {
      return;
    }
    lastScannedValueRef.current = currentScannedValue;
    setTimeout(() => {
      if (lastScannedValueRef.current === currentScannedValue) {
        lastScannedValueRef.current = '';
      }
    }, 2500);

    isProcessingScanRef.current = true;
    setLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Fail fast if the backend never responds: without this a hung request would
    // leave `loading`/`isProcessingScanRef` stuck forever, blocking all further
    // scans (the screen then looks like it stopped detecting QR codes).
    const timedOutRef = { current: false };
    const timeoutId = setTimeout(() => {
      timedOutRef.current = true;
      abortController.abort();
    }, 12000);

    try {
      let scannedValue = currentScannedValue;
      let response: any;
      let encryptDataForRecord = '';

      // Ownership-transfer link: .../transfer/:code -> open the confirmation screen
      // (works on native and the web scan page) instead of fetching product data.
      const transferUrlMatch = scannedValue.match(/\/transfer\/([^/?#]+)/i);
      if (transferUrlMatch) {
        const code = decodeURIComponent(transferUrlMatch[1]);
        if (isMountedRef.current) setLoading(false);
        isProcessingScanRef.current = false;
        navigation.navigate('TransferConfirm', { code });
        return;
      }

      // New format: .../product/:productId/:qrcodeId
      const productUrlMatch = scannedValue.match(/\/product\/([^/?#]+)\/([^/?#]+)/i);
      if (productUrlMatch) {
        response = await fetch(`${API_BASE_URL}qrcode/resolve-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({
            qrUrl: scannedValue,
            expectedQrUrl: expectedSecurityQrUrl || undefined,
          }),
        });
      } else {
        // Legacy format: encrypted value (optionally as ?qrcode=...)
        let encryptData = scannedValue;
        if (encryptData.includes('qrcode=')) {
          const [rawParam] = encryptData.split('qrcode=').slice(1);
          encryptData = rawParam?.split('&')[0] || '';
        }
        encryptData = normalizeEncryptData(encryptData);
        encryptDataForRecord = encryptData;
        response = await fetch(`${API_BASE_URL}qrcode/decrypt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({ encryptData }),
        });
      }

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        const productData = data.data;
        const securityCheckPassedByApi = data?.securityCheck?.isPassed !== false;
        if (expectedSecurityQrUrl && !securityCheckPassedByApi) {
          Alert.alert(t('error'), t('qrDoesNotMatch'));
          if (isMountedRef.current) {
            setLoading(false);
          }
          if (isFocused && scannerRef.current) {
            scannerRef.current.reactivate();
          }
          isProcessingScanRef.current = false;
          return;
        }

        // Record successful scan in backend (best effort).
        try {
          await fetch(`${API_BASE_URL}qrcode/scan/record`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              product_id: productData?._id,
              token_id: productData?.token_id,
              encryptData: encryptDataForRecord || productData?.scannedQRCode || scannedValue,
              user_id: user?._id,
              source: 'scan',
            }),
          });
        } catch (recordError) {
          console.error('Error recording scan:', recordError);
        }

        // Save scanned product to AsyncStorage
        try {
          const scannedProducts = await AsyncStorage.getItem('scannedProducts');
          const products = scannedProducts ? JSON.parse(scannedProducts) : [];
          
          // Keep one item per QR code.
          const existingIndex = products.findIndex(
            (p: any) => p.scannedQRCode === (productData?.scannedQRCode || scannedValue)
          );
          
          if (existingIndex >= 0) {
            // Update existing product
            products[existingIndex] = {
              ...productData,
              scannedQRCode: productData?.scannedQRCode || scannedValue,
              scannedAt: Date.now(),
            };
          } else {
            // Add new product
            products.push({
              ...productData,
              scannedQRCode: productData?.scannedQRCode || scannedValue,
              scannedAt: Date.now(),
            });
          }
          
          await AsyncStorage.setItem('scannedProducts', JSON.stringify(products));
        } catch (error) {
          console.error('Error saving scanned product:', error);
        }
        
        // Navigate to Result screen with product data
        if (!isMountedRef.current || !isFocused) {
          isProcessingScanRef.current = false;
          return;
        }

        navigation.replace('ScanSuccessful', {
          productData: {
            ...productData,
            scannedQRCode: productData?.scannedQRCode || scannedValue,
            scannedAt: Date.now(),
          },
          securityPassed: true,
        });
      } else {
        Alert.alert(t('error'), data.message || t('failedToDecryptProduct'));
        if (isMountedRef.current) {
          setLoading(false);
        }
        // Reactivate scanner after error
        if (isFocused && scannerRef.current) {
          scannerRef.current.reactivate();
        }
      }
    } catch (error) {
      // A real abort (navigating away) stays silent; a timeout abort is surfaced
      // as a network error so the user can retry instead of staring at a spinner.
      const abortError = error && (error as any).name === 'AbortError';
      const isTimeout = timedOutRef.current;
      const isSilentAbort = abortError && !isTimeout;
      if (!isSilentAbort) {
        Alert.alert(t('error'), t('networkErrorRetry'));
        console.error('Scan error:', error);
      }
      if (isMountedRef.current) {
        setLoading(false);
      }
      // Reactivate scanner after a surfaced error only when still focused.
      if (!isSilentAbort && isFocused && scannerRef.current) {
        scannerRef.current.reactivate();
      }
    } finally {
      clearTimeout(timeoutId);
      isProcessingScanRef.current = false;
      abortControllerRef.current = null;
    }
  };

  if (hasPermission === null) {
    return (
      <AppLayout
        navigation={navigation}
        user={user}
        onLogout={onLogout}
        showBackButton={true}
      >
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
            <Text style={styles.stateTitle}>{t('requestingCameraPermission')}</Text>
          </View>
        </View>
      </AppLayout>
    );
  }

  if (hasPermission === false) {
    return (
      <AppLayout
        navigation={navigation}
        user={user}
        onLogout={onLogout}
        showBackButton={true}
      >
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <View style={[styles.stateIconWrap, styles.stateIconWrapDanger]}>
              <Image source={require('../assets/shield.png')} style={styles.stateIconDanger} resizeMode="contain" />
            </View>
            <Text style={styles.stateTitle}>{t('cameraPermissionDenied')}</Text>
          </View>
        </View>
      </AppLayout>
    );
  }

  // Web photo-scan mode (http / no live camera) — clean light layout.
  if (Platform.OS === 'web' && (webPhotoMode || !QrReader)) {
    return (
      <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton={true}>
        <View style={styles.photoContainer}>
          <View style={styles.photoScanCard}>
            <Image source={require('../assets/qr-code.png')} style={styles.photoScanIcon} resizeMode="contain" />
            <Text style={styles.photoScanTitle}>{t('photoScanTitle')}</Text>
            <Text style={styles.photoScanSubtitle}>{t('photoScanSubtitle')}</Text>
            <TouchableOpacity style={styles.photoScanButton} onPress={openPhotoScan} disabled={loading}>
              <Text style={styles.photoScanButtonText}>
                {loading ? t('loading') : t('photoScanButton')}
              </Text>
            </TouchableOpacity>
            {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 14 }} />}
          </View>
        </View>
      </AppLayout>
    );
  }

  // Web live-camera scanner (https / localhost).
  if (Platform.OS === 'web') {
    return (
      <AppLayout
        navigation={navigation}
        user={user}
        onLogout={onLogout}
        showBackButton={true}
      >
        <View style={styles.container}>
          <View style={styles.topContent}>
            <View style={styles.hintCard}>
              <Image source={require('../assets/qr-code.png')} style={styles.hintIcon} resizeMode="contain" />
              <Text style={styles.hintText}>{t('scannerScanHint')}</Text>
            </View>
          </View>
          <View style={styles.scanViewport}>
            <View style={styles.webScannerContainer}>
              <QrReader
                delay={300}
                onError={(err: any) => {
                  console.error('QR Scanner Error:', err);
                }}
                onScan={(data: string | null) => {
                  if (data) {
                    handleQRCode(data);
                  }
                }}
                style={styles.webScanner}
              />
            </View>
          </View>
          <View style={styles.bottomContent}>
            {loading ? (
              <View style={styles.loadingPill}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingPillText}>{t('loadingProductInfo')}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={openPhotoScan}>
                <Text style={styles.scanCaptionLink}>{t('photoScanButton')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AppLayout>
    );
  }

  if (!isFocused) {
    return (
      <AppLayout
        navigation={navigation}
        user={user}
        onLogout={onLogout}
        showBackButton={true}
      >
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          </View>
        </View>
      </AppLayout>
    );
  }

  // Native QR Scanner Component
  if (QRCodeScanner && RNCamera) {
    return (
      <AppLayout
        navigation={navigation}
        user={user}
        onLogout={onLogout}
        showBackButton={true}
      >
        <View style={styles.container}>
          <QRCodeScanner
            ref={scannerRef}
            onRead={handleQRCode}
            reactivate={!loading}
            reactivateTimeout={3000}
            showMarker={true}
            cameraStyle={styles.camera}
            topContent={
              <View style={styles.topContent}>
                <View style={styles.hintCard}>
                  <Image source={require('../assets/qr-code.png')} style={styles.hintIcon} resizeMode="contain" />
                  <Text style={styles.hintText}>{t('scannerScanHint')}</Text>
                </View>
              </View>
            }
            bottomContent={
              <View style={styles.bottomContent}>
                {loading && (
                  <View style={styles.loadingPill}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.loadingPillText}>Loading product information...</Text>
                  </View>
                )}
              </View>
            }
            cameraProps={{
              flashMode: RNCamera.Constants.FlashMode.auto,
            }}
          />
        </View>
      </AppLayout>
    );
  }

  // Fallback if no scanner is available
  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={true}
    >
      <View style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <View style={[styles.stateIconWrap, styles.stateIconWrapDanger]}>
            <Image source={require('../assets/qr-code.png')} style={styles.stateIconDanger} resizeMode="contain" />
          </View>
          <Text style={styles.stateTitle}>{t('qrScannerUnavailable')}</Text>
        </View>
      </View>
    </AppLayout>
  );
}

const DARK = '#0b1220';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  camera: {
    flex: 1,
  },
  topContent: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  // Branded scan hint
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    maxWidth: 460,
    backgroundColor: 'rgba(31,51,97,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...shadow(2),
  },
  hintIcon: {
    width: 18,
    height: 18,
    tintColor: '#fff',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  // Camera viewport + frame
  scanViewport: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: DARK,
  },
  webScannerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  webScanner: {
    width: '100%',
    maxWidth: 500,
    height: '100%',
  },
  bottomContent: {
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  scanCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    textAlign: 'center',
  },
  scanCaptionLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  photoContainer: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingTop: 28,
    paddingHorizontal: spacing.lg,
  },
  photoScanCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    ...shadow(2),
  },
  photoScanIcon: {
    width: 56,
    height: 56,
    tintColor: colors.primary,
    marginBottom: 14,
  },
  photoScanTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.heading,
    textAlign: 'center',
    marginBottom: 6,
  },
  photoScanSubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 19,
  },
  photoScanButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 28,
    ...shadow(1),
  },
  photoScanButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    ...shadow(2),
  },
  loadingPillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Light-theme state screens (permission / unavailable / loading)
  stateContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  stateCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    ...shadow(2),
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stateIconWrapDanger: {
    backgroundColor: colors.dangerSoft,
  },
  stateIconDanger: {
    width: 32,
    height: 32,
    tintColor: colors.danger,
  },
  stateTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
});
