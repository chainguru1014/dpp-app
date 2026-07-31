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
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { useIsFocused } from '@react-navigation/native';
import { colors, radius, spacing, shadow } from '../theme';
import NativeCodeScanner, { isNativeCodeScannerAvailable, ScannedCodeFormat } from '../components/NativeCodeScanner';
import { isNfcSupported, readNfcTag } from '../utils/nfc';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat } from '@zxing/library';
import WebCodeScanner from '../components/WebCodeScanner';
import { isNativeImageScanAvailable, scanBarcodeFromImageUri } from '../utils/nativeImageScan';

// Guarded the same defensive way as the native code scanner/NFC modules —
// degrades gracefully if the native module isn't linked/rebuilt yet.
let launchImageLibrary: any = null;
try {
  launchImageLibrary = require('react-native-image-picker').launchImageLibrary;
} catch (e) {
  console.warn('react-native-image-picker not available:', e);
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
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  // Manual-entry fallback (web only) — a browser can't decode a 1D barcode or
  // read NFC/RFID off a live feed, so this lets those identifier types still
  // be exercised from a laptop by typing the value instead of scanning it.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualType, setManualType] = useState<'barcode' | 'nfc' | 'rfid' | 'gs1dl'>('barcode');
  const [manualValue, setManualValue] = useState('');
  const isMountedRef = useRef(true);
  const isProcessingScanRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastScannedValueRef = useRef<string>('');
  const expectedSecurityQrUrl = String(route?.params?.expectedSecurityQrUrl || '').trim();

  React.useEffect(() => {
    requestCameraPermission();
  }, []);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    isNfcSupported().then((supported) => {
      if (isMountedRef.current) setNfcAvailable(supported);
    });
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

  // Decode a QR code or 1D/2D barcode from a picked/captured image (works
  // over http, no camera stream needed). Uses the same ZXing decoder
  // WebCodeScanner uses for the live feed — previously this used jsQR (QR
  // only) plus a hand-rolled, angle/scale-sensitive EAN-13 reader, which
  // decoded a clean upload fine but was too strict for anything off-axis.
  // Web only.
  const decodeImageFromFile = (file: any) => {
    const w: any = globalThis as any;
    setLoading(true);
    try {
      const reader = new w.FileReader();
      reader.onload = () => {
        const img = new w.Image();
        img.onload = async () => {
          try {
            const codeReader = new BrowserMultiFormatReader();
            const result = await codeReader.decodeFromImageElement(img);
            setLoading(false);
            const format = result.getBarcodeFormat ? result.getBarcodeFormat() : null;
            handleScannedCode(String(result.getText()), format === BarcodeFormat.QR_CODE ? 'qr' : 'barcode');
          } catch (err) {
            setLoading(false);
            Alert.alert(t('error'), t('noQrInImage'));
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

  // Native (Android/iOS) equivalent of openPhotoScan/decodeImageFromFile
  // above — those use browser-only DOM/canvas APIs and only ever ran on web.
  // Picks a gallery image via react-native-image-picker, then decodes it
  // on-device with ML Kit (see utils/nativeImageScan), covering the exact
  // same QR + 1D/2D barcode formats the live NativeCodeScanner reads.
  const pickNativePhotoAndScan = () => {
    if (!launchImageLibrary || !isNativeImageScanAvailable()) {
      Alert.alert(t('error'), t('photoScanNotSupported'));
      return;
    }
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: false }, async (response: any) => {
      if (response?.didCancel || response?.errorCode) return;
      const uri = response?.assets && response.assets[0] && response.assets[0].uri;
      if (!uri) return;
      setLoading(true);
      try {
        const result = await scanBarcodeFromImageUri(uri);
        setLoading(false);
        if (result) {
          handleScannedCode(result.value, result.format);
        } else {
          Alert.alert(t('error'), t('noQrInImage'));
        }
      } catch (err) {
        setLoading(false);
        Alert.alert(t('error'), t('couldNotReadImage'));
      }
    });
  };

  // Anything that isn't our own QR carries no product_id at all — resolve it
  // against the admin-curated ProductIdentifier mapping instead (see backend
  // productIdentifierController). 404s if nobody has registered this
  // identifier to a product yet.
  type ScanSourceType = 'barcode' | 'nfc' | 'rfid' | 'gs1dl';
  const attemptPmcLookup = async (rawValue: string, sourceType: ScanSourceType, signal: AbortSignal) => {
    const resp = await fetch(`${API_BASE_URL}pmc/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ source_type: sourceType, raw_value: rawValue }),
    });
    const json = await resp.json();
    return { response: resp, data: json };
  };

  const handleScannedCode = async (value: any, format: ScannedCodeFormat | 'nfc' | 'rfid' = 'qr') => {
    if (!isFocused || isProcessingScanRef.current) return;

    const currentScannedValue = String(value || '').trim();
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
      let data: any;
      let encryptDataForRecord = '';
      // Tracks the identifier format that actually resolved the scan — starts
      // as `format`, but a QR that falls through to the GS1 lookup below
      // resolves as 'gs1dl' even though the physical code scanned was a QR.
      let resolvedIdentifierType: string = format;

      if (format !== 'qr') {
        // A 1D/2D product barcode, NFC tag, or RFID tag never matches our own
        // QR URL/encrypted formats — it carries no product_id at all, so it
        // only resolves via the admin-curated identifier mapping.
        ({ response, data } = await attemptPmcLookup(scannedValue, format, abortController.signal));
      } else {
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
          data = await response.json();
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
          data = await response.json();

          // Not one of our own formats — maybe a GS1 Digital Link URL or
          // bracketed AI element string from a company that doesn't mint
          // through this platform at all.
          if (!(response.ok && data.status === 'success')) {
            resolvedIdentifierType = 'gs1dl';
            ({ response, data } = await attemptPmcLookup(scannedValue, 'gs1dl', abortController.signal));
          }
        }
      }

      if (response.ok && data.status === 'success') {
        const productData = data.data;
        const securityCheckPassedByApi = data?.securityCheck?.isPassed !== false;
        if (expectedSecurityQrUrl && !securityCheckPassedByApi) {
          Alert.alert(t('error'), t('qrDoesNotMatch'));
          if (isMountedRef.current) {
            setLoading(false);
          }
          isProcessingScanRef.current = false;
          return;
        }

        // Record successful scan in backend (best effort). Barcode/GS1-DL
        // resolved products have no per-unit token_id — pmc_code (already
        // resolved by pmc/lookup above) is what the backend stores instead.
        try {
          await fetch(`${API_BASE_URL}qrcode/scan/record`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              product_id: productData?._id,
              token_id: productData?.token_id,
              pmc_code: productData?.pmc_code,
              identifier_type: resolvedIdentifierType,
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
    } finally {
      clearTimeout(timeoutId);
      isProcessingScanRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleNfcScanPress = async () => {
    if (nfcReading || isProcessingScanRef.current) return;
    setNfcReading(true);
    try {
      const value = await readNfcTag();
      if (value) {
        await handleScannedCode(value, 'nfc');
      } else {
        Alert.alert(t('error'), t('nfcReadFailed'));
      }
    } finally {
      if (isMountedRef.current) setNfcReading(false);
    }
  };

  const MANUAL_TYPES: { value: 'barcode' | 'nfc' | 'rfid' | 'gs1dl'; label: string }[] = [
    { value: 'barcode', label: 'Barcode' },
    { value: 'nfc', label: 'NFC' },
    { value: 'rfid', label: 'RFID' },
    { value: 'gs1dl', label: 'GS1 Link' },
  ];

  const submitManualEntry = () => {
    const value = manualValue.trim();
    if (!value || loading) return;
    handleScannedCode(value, manualType);
  };

  // hideToggle: skip the link this renders by default — used when a caller
  // (the white board below) provides its own "Enter Manually" button that
  // drives the same manualOpen state instead.
  const renderManualEntry = (light = false, hideToggle = false) => (
    <View style={styles.manualWrap}>
      {!hideToggle && (
        <TouchableOpacity onPress={() => setManualOpen((v) => !v)} disabled={loading}>
          <Text style={[styles.scanCaptionLink, light && styles.scanCaptionLinkDark]}>
            {manualOpen ? 'Hide manual entry' : 'Enter code manually'}
          </Text>
        </TouchableOpacity>
      )}
      {manualOpen && (
        <View style={styles.manualCard}>
          <View style={styles.manualChipRow}>
            {MANUAL_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.manualChip, manualType === opt.value && styles.manualChipActive]}
                onPress={() => setManualType(opt.value)}
              >
                <Text style={[styles.manualChipText, manualType === opt.value && styles.manualChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.manualInput}
            value={manualValue}
            onChangeText={setManualValue}
            placeholder="Paste or type the identifier value"
            placeholderTextColor="rgba(11,18,32,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={submitManualEntry}
          />
          <TouchableOpacity
            style={[styles.manualSubmit, (!manualValue.trim() || loading) && styles.manualSubmitDisabled]}
            onPress={submitManualEntry}
            disabled={!manualValue.trim() || loading}
          >
            <Text style={styles.photoScanButtonText}>{loading ? 'Checking…' : 'Check'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // White board below the camera viewport: "Upload Photo" (reuses the
  // existing openPhotoScan/pickNativePhotoAndScan handlers) and "Enter
  // Manually" (drives renderManualEntry's manualOpen state via hideToggle).
  const renderWhiteBoard = () => {
    const onUploadPhoto = Platform.OS === 'web' ? openPhotoScan : pickNativePhotoAndScan;
    return (
      <View style={styles.whiteBoard}>
        {loading ? (
          <View style={styles.loadingPillLight}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingPillLightText}>{t('loadingProductInfo')}</Text>
          </View>
        ) : (
          <View style={styles.whiteBoardRow}>
            <TouchableOpacity style={styles.whiteBoardButton} onPress={onUploadPhoto} activeOpacity={0.8}>
              <Image source={require('../assets/qr-code.png')} style={styles.whiteBoardIcon} resizeMode="contain" />
              <Text style={styles.whiteBoardButtonText}>{t('scanUploadPhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.whiteBoardButton}
              onPress={() => setManualOpen((v) => !v)}
              activeOpacity={0.8}
            >
              <Image source={require('../assets/menu.png')} style={styles.whiteBoardIcon} resizeMode="contain" />
              <Text style={styles.whiteBoardButtonText}>{t('scanEnterManually')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {Platform.OS !== 'web' && nfcAvailable && !loading && (
          <TouchableOpacity style={styles.whiteBoardNfc} onPress={handleNfcScanPress} disabled={nfcReading}>
            {nfcReading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.whiteBoardNfcText}>{t('nfcScanButton')}</Text>
            )}
          </TouchableOpacity>
        )}
        {renderManualEntry(false, true)}
      </View>
    );
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
  if (Platform.OS === 'web' && webPhotoMode) {
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
          {renderManualEntry(true)}
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
              <WebCodeScanner
                active={isFocused && !loading}
                onScan={(value, format) => handleScannedCode(value, format)}
              />
            </View>
            <View pointerEvents="none" style={styles.frameOverlay}>
              <View style={styles.scanFrame} />
            </View>
          </View>
          {renderWhiteBoard()}
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

  // Native QR + barcode scanner (react-native-vision-camera). Reads QR codes
  // and the common 1D/2D product-barcode formats in one pass.
  if (isNativeCodeScannerAvailable()) {
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
            <NativeCodeScanner active={isFocused && !loading} onScan={handleScannedCode} />
            <View pointerEvents="none" style={styles.frameOverlay}>
              <View style={styles.scanFrame} />
            </View>
          </View>
          {renderWhiteBoard()}
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
          {isNativeImageScanAvailable() && (
            <TouchableOpacity
              style={[styles.photoScanButton, { marginTop: spacing.lg }]}
              onPress={pickNativePhotoAndScan}
              disabled={loading}
            >
              <Text style={styles.photoScanButtonText}>
                {loading ? t('loading') : t('photoScanButton')}
              </Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: 'rgba(47,128,200,0.92)',
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
    fontWeight: '400',
    flexShrink: 1,
    textAlign: 'center',
  },
  // Camera viewport + frame
  scanViewport: {
    flex: 1,
    // Guarantee a tall camera area even if the flex chain collapses on web,
    // so the centred frame lands on the middle of the camera view.
    minHeight: 420,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: DARK,
  },
  webScannerContainer: {
    // Fill the whole viewport so the camera covers it and the frame centres on it.
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  // Light frame over the camera viewport (replaces the library's coral default).
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  bottomContent: {
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  // White board below the camera viewport (consumer flow) — Upload Photo /
  // Enter Manually, replacing the old dark-viewport link style.
  whiteBoard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    ...shadow(2),
  },
  whiteBoardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  whiteBoardButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  whiteBoardIcon: {
    width: 26,
    height: 26,
    tintColor: colors.primary,
    marginBottom: spacing.sm,
  },
  whiteBoardButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  whiteBoardNfc: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  whiteBoardNfcText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  loadingPillLight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingPillLightText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '400',
  },
  scanCaption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    textAlign: 'center',
  },
  scanCaptionLink: {
    marginBottom: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  // Same link, readable on the light photo-scan background instead of the
  // dark camera-viewport background scanCaptionLink was designed for.
  scanCaptionLinkDark: {
    color: colors.accent,
  },
  manualWrap: {
    marginTop: spacing.md - 40,
    alignItems: 'center',
    width: '100%',
  },
  manualCard: {
    marginTop: spacing.md,
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow(2),
  },
  manualChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  manualChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  manualChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  manualChipText: {
    fontSize: 13,
    color: colors.text,
  },
  manualChipTextActive: {
    color: '#fff',
  },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md,
  },
  manualSubmit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: 20,
    alignItems: 'center',
    ...shadow(1),
  },
  manualSubmitDisabled: {
    opacity: 0.5,
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
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
});
