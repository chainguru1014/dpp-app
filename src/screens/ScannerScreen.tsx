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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { useIsFocused } from '@react-navigation/native';

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
      // For web, check if getUserMedia is available
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          setHasPermission(true);
        } else {
          setHasPermission(false);
          Alert.alert(t('error'), t('cameraNotAvailableBrowser'));
          navigation.goBack();
        }
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
        navigation.goBack();
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

    try {
      let scannedValue = currentScannedValue;
      let response: any;
      let encryptDataForRecord = '';

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
          Alert.alert(t('error'), 'Scanned QR does not match this product.');
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

        navigation.replace('Result', {
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
      const abortError = error && (error as any).name === 'AbortError';
      if (!abortError) {
        Alert.alert(t('error'), t('networkErrorRetry'));
        console.error('Scan error:', error);
      }
      if (isMountedRef.current) {
        setLoading(false);
      }
      // Reactivate scanner after error only when still focused
      if (!abortError && isFocused && scannerRef.current) {
        scannerRef.current.reactivate();
      }
    } finally {
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>{t('requestingCameraPermission')}</Text>
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
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{t('cameraPermissionDenied')}</Text>
        </View>
      </AppLayout>
    );
  }

  // Web QR Scanner Component
  if (Platform.OS === 'web' && QrReader) {
    return (
      <AppLayout
        navigation={navigation}
        user={user}
        onLogout={onLogout}
        showBackButton={true}
      >
        <View style={styles.container}>
          <View style={styles.topContent}>
            <Text style={styles.centerText}>
              {t('scannerScanHint')}
            </Text>
          </View>
          <View style={styles.webScannerContainer}>
            {QrReader && (
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
            )}
          </View>
          <View style={styles.bottomContent}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#1976d2" />
                <Text style={styles.loadingText}>{t('loadingProductInfo')}</Text>
              </View>
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
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
                <Text style={styles.centerText}>
                  {t('scannerScanHint')}
                </Text>
              </View>
            }
            bottomContent={
              <View style={styles.bottomContent}>
                {loading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#1976d2" />
                    <Text style={styles.loadingText}>Loading product information...</Text>
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
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('qrScannerUnavailable')}</Text>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  topContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  centerText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
    borderRadius: 8,
  },
  bottomContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#d32f2f',
    marginBottom: 20,
    textAlign: 'center',
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
});
