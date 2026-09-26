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
import GradientButton from '../components/GradientButton';
import MediaSlider from '../components/MediaSlider';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow, MIN_TOUCH } from '../theme';
import WebCodeScanner, { WebCodeScannerHandle } from '../components/WebCodeScanner';
import CaptureCameraView, { CaptureCameraHandle, isCaptureCameraAvailable, CapturedCodeFormat } from '../components/CaptureCameraView';
import { requestNativeCameraPermission } from '../components/NativeCodeScanner';
import ScanFrameCorners from '../components/ScanFrameCorners';
import { getCurrentLocation, getDeviceInfo } from '../utils/deviceCapture';
import { uploadCaptureImage } from '../utils/uploadCapture';
import { isNfcSupported, readNfcTag } from '../utils/nfc';
import DUMMY_RFID_TAGS from '../data/dummyRfidTags.json';
import { connectYometelReader, disconnectYometelReader, scanOnceYometel } from '../native/yometelRfid';

const LIVENESS_TIMEOUT_MS = 700;
// How often to poll for recent RFID tag detections while RFID mode is
// selected — comfortably inside the 5s server-side detection window so a
// tag that just appeared shows up within a beat, not right at the edge.
const RFID_POLL_MS = 1500;
const RFID_WINDOW_SECONDS = 5;
// Presentation/demo mode: no real RFID gateway is wired up yet (see the
// mocked Connect state above), so instead of polling /rfid/recent, a fixed
// list of dummy tags (data/dummyRfidTags.json) is revealed one at a time on
// a timer to simulate tags passing near the reader. Every step downstream —
// pmc/lookup, POST /captures, GET /captures — is still the real backend;
// only the detection signal itself is faked. Flip to false once a real
// reader/gateway is posting to /rfid/ingest, to restore live polling.
const RFID_SIMULATION_MODE = true;
const RFID_SIMULATION_DELAY_MS = 4000;
// Real vs Simulate is picked per session with the radio pair next to the
// reader chips. Only Yometel has a real transport (Android BLE, see
// android/app/src/main/java/com/yometel/dpp/rfid); Impinj/Zebra are pending
// hardware confirmation, so they're always Simulate. Real on a non-Android
// build fails at Connect with connectYometelReader's "Android-only" error.
type RfidMode = 'real' | 'simulate';

// pmc/lookup returns product images as bare upload filenames — same
// resolution every other product-image screen uses.
const fileUrl = (f: string) => {
  if (!f) return '';
  if (/^https?:\/\//i.test(f)) return f;
  return `${API_BASE_URL}files/${String(f).replace(/^\/+/, '')}`;
};

type CaptureType = 'qr' | 'barcode' | 'rfid' | 'nfc';
type RfidReaderType = 'yometel' | 'impinj' | 'zebra';

const RFID_READER_TYPES: { key: RfidReaderType; labelKey: any }[] = [
  { key: 'yometel', labelKey: 'rfidReaderYometel' },
  { key: 'impinj', labelKey: 'rfidReaderImpinj' },
  { key: 'zebra', labelKey: 'rfidReaderZebra' },
];

const CAPTURE_TYPES: { key: CaptureType; labelKey: any; icon: string }[] = [
  { key: 'qr', labelKey: 'captureTypeQr', icon: 'qr-code' },
  { key: 'rfid', labelKey: 'captureTypeRfid', icon: 'wifi-tethering' },
  { key: 'barcode', labelKey: 'captureTypeBarcode', icon: 'view-week' },
  { key: 'nfc', labelKey: 'captureTypeNfc', icon: 'nfc' },
];

interface ProcessStep {
  entity: string;
  type: string;
}

interface RfidTag {
  epc: string;
  antennaId?: string;
  rssi?: number;
  seenAt: string;
}

interface CaptureDoc {
  _id: string;
  refNumber: string;
  rawValue: string;
  identifierType: string;
  imagePath: string;
  productImage?: string;
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
  const initialCaptureType: CaptureType = route?.params?.captureType === 'rfid' ? 'rfid' : 'qr';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [step, setStep] = useState<ProcessStep | null>(null);
  const [captures, setCaptures] = useState<CaptureDoc[]>([]);
  const [liveCode, setLiveCode] = useState<{ value: string; format: CapturedCodeFormat; manual?: boolean; productId?: string; qrcodeId?: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeUnrecognized, setCodeUnrecognized] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [captureType, setCaptureType] = useState<CaptureType>(initialCaptureType);
  const [rfidTags, setRfidTags] = useState<RfidTag[]>([]);
  // Per-EPC product resolution for the Passing Tags card — populated as each
  // tag gets auto-captured (see captureRfidTag), so each row can show the
  // product's image and be tappable straight to its detail page. `null`
  // means "looked up, not registered to a product"; absent means "not
  // looked up yet" (briefly, right when a tag first appears).
  const [rfidProductByEpc, setRfidProductByEpc] = useState<Record<string, { productId?: string; qrcodeId?: string; productImage?: string; product?: any } | null>>({});
  // The tag currently shown in the tap-to-preview dialog — holds both the
  // resolved product object and the tapped tag so the dialog's "View Product
  // Details" button can still navigate with the right ids.
  const [previewTag, setPreviewTag] = useState<{ product: any; productId?: string; qrcodeId?: string } | null>(null);
  const [rfidReaderType, setRfidReaderType] = useState<RfidReaderType>('yometel');
  // Mocked connection state, per reader type — no real BLE/LLRP hardware is
  // wired up yet (see project notes). Connect just flips this locally; the
  // actual tag data still comes from the real /rfid/recent polling endpoint,
  // so swapping in real hardware later only needs to replace this flip with
  // an actual connect call, not the polling/capture pipeline below it.
  const [rfidConnectedByType, setRfidConnectedByType] = useState<Record<RfidReaderType, boolean>>({
    yometel: false,
    impinj: false,
    zebra: false,
  });
  // Only meaningful for the Yometel branch (real BLE connect can take a few
  // seconds) — Impinj/Zebra's mocked Connect is instant, no loading state.
  // Yometel's own choice; Impinj/Zebra ignore it (always simulate).
  const [rfidMode, setRfidMode] = useState<RfidMode>('real');
  const isRealYometel = rfidReaderType === 'yometel' && rfidMode === 'real';
  const [rfidConnecting, setRfidConnecting] = useState(false);
  const [rfidConnectError, setRfidConnectError] = useState('');
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  // Camera-freeze recovery (autofocus-hardware fault — see utils/cameraResilience).
  const [cameraStalled, setCameraStalled] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const cameraInitializedRef = useRef(false);

  const tokenRef = useRef<string>('');
  const lastSeenAtRef = useRef<number>(0);
  const lastCheckedValueRef = useRef<string>('');
  const livenessIntervalRef = useRef<any>(null);
  const rfidPollIntervalRef = useRef<any>(null);
  // Guards the auto-capture effect against re-logging the same tag on every
  // poll tick while it just sits in range — only a genuinely new freshest
  // EPC (or reconnecting) triggers another capture+log call.
  const lastAutoCapturedEpcRef = useRef<string>('');
  // How many dummy tags have been revealed so far this "connection" —
  // resets to 0 on disconnect so reconnecting replays the demo from tag 1.
  const dummyRevealIndexRef = useRef(0);
  const nativeCameraRef = useRef<CaptureCameraHandle>(null);
  const webScannerRef = useRef<WebCodeScannerHandle>(null);
  // Left/right scroll chevrons for the capture-type row — same pattern as
  // ProductLifecycleScreen's tab row (canScrollTabsLeft/Right + scrollTabsBy).
  const typeScrollRef = useRef<ScrollView>(null);
  const [typeViewportWidth, setTypeViewportWidth] = useState(0);
  const [typeContentWidth, setTypeContentWidth] = useState(0);
  const [typeScrollX, setTypeScrollX] = useState(0);
  const canScrollTypesLeft = typeScrollX > 4;
  const canScrollTypesRight = typeContentWidth - typeViewportWidth - typeScrollX > 4;
  const scrollTypesBy = (dir: 1 | -1) => {
    const step = Math.max(120, typeViewportWidth * 0.7);
    const next = Math.max(0, Math.min(typeContentWidth - typeViewportWidth, typeScrollX + dir * step));
    typeScrollRef.current?.scrollTo({ x: next, animated: true });
  };

  const isCameraType = captureType === 'qr' || captureType === 'barcode';

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
      } else if (Platform.OS === 'ios') {
        // react-native-vision-camera does not prompt automatically just
        // because <Camera> mounts; it must be requested explicitly or the
        // preview stays black with no permission dialog ever shown.
        try {
          setHasPermission(await requestNativeCameraPermission());
        } catch (err) {
          console.warn(err);
          setHasPermission(false);
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

  useEffect(() => {
    if (Platform.OS === 'web') return;
    isNfcSupported().then(setNfcAvailable);
  }, []);

  // Native camera-freeze watchdog — mirrors the consumer ScannerScreen: if
  // the vision-camera session never reports onInitialized after (re)mount,
  // the autofocus pipeline is likely stuck; show the recovery card.
  useEffect(() => {
    if (Platform.OS === 'web' || !isFocused || !isCameraType || !isCaptureCameraAvailable()) return undefined;
    cameraInitializedRef.current = false;
    const timer = setTimeout(() => {
      if (!cameraInitializedRef.current) setCameraStalled(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isFocused, isCameraType, cameraKey]);

  const handleCameraInitialized = () => {
    cameraInitializedRef.current = true;
    setCameraStalled(false);
  };

  const retryCamera = () => {
    cameraInitializedRef.current = false;
    setCameraStalled(false);
    setCameraKey((k) => k + 1);
  };

  const forceFocusAndRetry = async () => {
    try {
      await nativeCameraRef.current?.lockFocusCenter();
    } catch (err) {
      console.warn('forceFocusAndRetry failed:', err);
    }
    retryCamera();
  };

  // Switching capture type clears whatever the previous type had detected —
  // a stale liveCode/RFID tag from the old mode shouldn't carry over and
  // wrongly enable Capture for the new one.
  useEffect(() => {
    setLiveCode(null);
    setCodeUnrecognized(false);
    lastCheckedValueRef.current = '';
    setRfidTags([]);
    setRfidProductByEpc({});
    lastAutoCapturedEpcRef.current = '';
  }, [captureType]);

  // Polls for recent RFID tag detections while RFID mode is selected, the
  // screen is focused, and the selected reader type is (mock-)connected —
  // this is what feeds the auto-capture effect below and the recent-captures
  // card. Stops polling immediately when leaving RFID mode, the screen, or
  // disconnecting.
  const rfidReady = captureType === 'rfid' && isFocused && rfidConnectedByType[rfidReaderType];

  useEffect(() => {
    if (!rfidReady) {
      if (rfidPollIntervalRef.current) clearInterval(rfidPollIntervalRef.current);
      setRfidTags([]);
      setRfidProductByEpc({});
      lastAutoCapturedEpcRef.current = '';
      dummyRevealIndexRef.current = 0;
      return;
    }

    if (isRealYometel) {
      let cancelled = false;
      const poll = async () => {
        try {
          const tags = await scanOnceYometel();
          if (!cancelled) setRfidTags(tags);
        } catch (err) {
          if (!cancelled) setRfidTags([]);
        }
      };
      poll();
      rfidPollIntervalRef.current = setInterval(poll, RFID_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(rfidPollIntervalRef.current);
      };
    }

    if (RFID_SIMULATION_MODE) {
      let cancelled = false;
      const revealNext = () => {
        if (cancelled) return;
        const idx = dummyRevealIndexRef.current;
        if (idx >= DUMMY_RFID_TAGS.length) return; // played through the demo list — stay idle
        const tag = DUMMY_RFID_TAGS[idx];
        dummyRevealIndexRef.current = idx + 1;
        setRfidTags((prev) => [{ epc: tag.epc, seenAt: new Date().toISOString() }, ...prev]);
      };
      revealNext(); // first tag appears immediately on connect, not after a delay
      rfidPollIntervalRef.current = setInterval(revealNext, RFID_SIMULATION_DELAY_MS);
      return () => {
        cancelled = true;
        clearInterval(rfidPollIntervalRef.current);
      };
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}rfid/recent?windowSeconds=${RFID_WINDOW_SECONDS}`);
        // Explicitly treat any non-2xx (404 if the endpoint isn't deployed
        // yet, 5xx, etc.) as "no tags" rather than trusting the response
        // body to happen to be empty — Capture must stay disabled whenever
        // the RFID API call itself didn't succeed, not just when it
        // succeeds with zero tags.
        if (!res.ok) {
          if (!cancelled) setRfidTags([]);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setRfidTags(data?.data?.tags || []);
      } catch (err) {
        if (!cancelled) setRfidTags([]);
      }
    };

    poll();
    rfidPollIntervalRef.current = setInterval(poll, RFID_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(rfidPollIntervalRef.current);
    };
  }, [rfidReady, rfidReaderType, isRealYometel]);

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

  // Shared pmc/lookup call for the two non-camera capture types (RFID EPC,
  // NFC tag id/UID) — same resolution path verifyScannedCode's barcode
  // branch uses, just parameterized by source_type instead of hardcoded to
  // 'barcode'.
  const lookupBySourceType = async (sourceType: 'rfid' | 'nfc', value: string): Promise<{ recognized: boolean; productId?: string; qrcodeId?: string; productImage?: string; product?: any }> => {
    try {
      const res = await fetch(`${API_BASE_URL}pmc/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType, raw_value: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success') {
        return {
          recognized: true,
          productId: data.data?._id ? String(data.data._id) : undefined,
          qrcodeId: data.data?.token_id != null ? String(data.data.token_id) : undefined,
          // pmc/lookup returns normalizeProductMedia(product) — images is
          // always a plain string array there, first entry is the product's
          // primary image. Used by the RFID recent-captures card, which has
          // no photo of its own to show (unlike qr/barcode).
          productImage: Array.isArray(data.data?.images) && data.data.images.length > 0 ? String(data.data.images[0]) : undefined,
          // Full lookup payload (name/brandInfo/productType/color/size/
          // detailFacts/images/...), cached so the RFID Passing Tags preview
          // dialog can show it without a second network call.
          product: data.data,
        };
      }
      return { recognized: false };
    } catch (err) {
      console.error('lookupBySourceType failed:', err);
      return { recognized: false };
    }
  };

  const postCapture = async (payload: { rawValue: string; identifierType: string; imagePath: string; productId?: string; qrcodeId?: string; productImage?: string; location: any; device: any }) => {
    await fetch(`${API_BASE_URL}captures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
      },
      body: JSON.stringify({ stepIndex, ...payload }),
    });
  };

  const handleScan = (value: string, format: CapturedCodeFormat, manual = false) => {
    // Only accept a detection matching the currently selected capture type
    // — e.g. a barcode in frame shouldn't enable Capture while "QR Code" is
    // selected, and vice versa. The camera scans both formats regardless of
    // selection, so this is what actually enforces the selector's meaning.
    // Manual entry bypasses this — it's explicitly typed for whichever type
    // is already selected.
    if (!manual && format !== captureType) return;
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

  // Android 12+ requires runtime grant for BLUETOOTH_CONNECT even though
  // it's a normal (not dangerous-at-install-time) permission pre-31 — same
  // PermissionsAndroid.request pattern already used above for CAMERA.
  const ensureBluetoothConnectPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android' || Platform.Version < 31) return true;
    try {
      const granted = await PermissionsAndroid.request(
        'android.permission.BLUETOOTH_CONNECT' as any,
        {
          title: t('rfidBluetoothPermissionTitle'),
          message: t('rfidBluetoothPermissionMessage'),
          buttonNeutral: t('askMeLater'),
          buttonNegative: t('cancel'),
          buttonPositive: t('ok'),
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('BLUETOOTH_CONNECT permission request failed:', err);
      return false;
    }
  };

  const handleConnectPress = async () => {
    if (!isRealYometel) {
      // Simulate (and Impinj/Zebra, always simulated) — virtual connection.
      setRfidConnectedByType((prev) => ({ ...prev, [rfidReaderType]: true }));
      return;
    }
    const readerId = user?.rfidReaderIds?.yometel;
    if (!readerId) return;
    setRfidConnectError('');
    setRfidConnecting(true);
    try {
      const allowed = await ensureBluetoothConnectPermission();
      if (!allowed) {
        setRfidConnectError(t('rfidBluetoothPermissionDenied'));
        return;
      }
      await connectYometelReader(readerId);
      setRfidConnectedByType((prev) => ({ ...prev, yometel: true }));
    } catch (err: any) {
      console.error('Yometel connect failed:', err);
      setRfidConnectError(err?.message || t('rfidConnectFailed'));
    } finally {
      setRfidConnecting(false);
    }
  };

  const handleDisconnectPress = async () => {
    if (isRealYometel) {
      try {
        await disconnectYometelReader();
      } catch (err) {
        console.warn('Yometel disconnect failed:', err);
      }
    }
    setRfidConnectedByType((prev) => ({ ...prev, [rfidReaderType]: false }));
  };

  // Switching Real <-> Simulate drops the current connection (a real BLE link
  // is closed) so the next Connect uses the newly selected mode.
  const handleRfidModeChange = async (mode: RfidMode) => {
    if (mode === rfidMode) return;
    if (isRealYometel && rfidConnectedByType.yometel) {
      try {
        await disconnectYometelReader();
      } catch (err) {
        console.warn('Yometel disconnect failed:', err);
      }
    }
    setRfidConnectedByType((prev) => ({ ...prev, yometel: false }));
    setRfidConnectError('');
    setRfidMode(mode);
  };

  // Logs one detected RFID tag — called automatically by the auto-capture
  // effect below (RFID mode has no manual Capture button; a tag passing near
  // a connected reader is captured on its own). Every detected tag is
  // logged for the audit trail regardless of whether it resolves to a
  // product; only the on-screen recent-captures card filters unregistered
  // ones out (see the bottomBoard render below).
  const captureRfidTag = async (tag: RfidTag) => {
    try {
      const [{ recognized, productId, qrcodeId, productImage, product }, location, device] = await Promise.all([
        lookupBySourceType('rfid', tag.epc),
        getCurrentLocation(),
        getDeviceInfo(),
      ]);
      setRfidProductByEpc((prev) => ({
        ...prev,
        [tag.epc]: recognized ? { productId, qrcodeId, productImage, product } : null,
      }));
      await postCapture({
        rawValue: tag.epc,
        identifierType: 'rfid',
        imagePath: '',
        productId,
        qrcodeId,
        productImage,
        location: location || undefined,
        device,
      });
      if (!recognized) {
        console.log('RFID tag captured but not registered to a product:', tag.epc);
      }
      await loadCaptures();
    } catch (err) {
      console.error('RFID auto-capture failed:', err);
    }
  };

  // Fires whenever the freshest polled tag (rfidTags is newest-first) is a
  // different EPC than the last one this screen already logged — that's
  // what "a new tag just started passing near the reader" means here, since
  // rfidTags refreshes on every poll tick even while the same tag stays in
  // range.
  useEffect(() => {
    if (!rfidReady || rfidTags.length === 0) return;
    const latest = rfidTags[0];
    if (latest.epc === lastAutoCapturedEpcRef.current) return;
    lastAutoCapturedEpcRef.current = latest.epc;
    captureRfidTag(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfidReady, rfidTags]);

  const handleCapture = async () => {
    if (capturing) return;

    if (captureType === 'nfc') {
      if (nfcReading) return;
      setCapturing(true);
      setNfcReading(true);
      try {
        const value = await readNfcTag();
        if (!value) {
          setCodeUnrecognized(true);
          return;
        }
        const [{ recognized, productId, qrcodeId }, location, device] = await Promise.all([
          lookupBySourceType('nfc', value),
          getCurrentLocation(),
          getDeviceInfo(),
        ]);
        setCodeUnrecognized(!recognized);
        await postCapture({
          rawValue: value,
          identifierType: 'nfc',
          imagePath: '',
          productId,
          qrcodeId,
          location: location || undefined,
          device,
        });
        await loadCaptures();
      } catch (err) {
        console.error('NFC capture failed:', err);
      } finally {
        setNfcReading(false);
        setCapturing(false);
      }
      return;
    }

    // Camera-driven types (qr / barcode) — unchanged
    // from the original flow, still gated on liveCode.
    if (!liveCode) return;
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

      await postCapture({
        rawValue: liveCode.value,
        identifierType: liveCode.format,
        imagePath: imagePath || '',
        productId: liveCode.productId,
        qrcodeId: liveCode.qrcodeId,
        location: location || undefined,
        device,
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

  const captureEnabled = isCameraType
    ? !!liveCode
    : captureType === 'nfc'
      ? nfcAvailable && !nfcReading
      : rfidTags.length > 0;

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
        <WebCodeScanner
          key={cameraKey}
          ref={webScannerRef}
          active={isFocused}
          onScan={handleScan}
          mode="continuous"
          onCameraStalled={() => setCameraStalled(true)}
        />
      );
    }
    if (isCaptureCameraAvailable()) {
      return (
        <CaptureCameraView
          key={cameraKey}
          ref={nativeCameraRef}
          active={isFocused}
          onScan={handleScan}
          torch={torchOn}
          onInitialized={handleCameraInitialized}
          onError={() => setCameraStalled(true)}
        />
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
      flatContent
    >
      <View style={styles.container}>
        <View style={styles.infoStrip}>
          <View style={styles.infoCell}>
            <VectorIcon name="event" size={21} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpDateLabel')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{dateLabel}</Text>
          </View>
          <View style={styles.infoCell}>
            <VectorIcon name="show-chart" size={21} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpTodayScans')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{captures.length}</Text>
          </View>
          <View style={styles.infoCell}>
            <VectorIcon name="description" size={21} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpCurrentRef')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{currentRef}</Text>
          </View>
          <View style={styles.infoCell}>
            <VectorIcon name="person" size={21} color={colors.primary} />
            <Text style={styles.infoLabel}>{t('corpTerminal')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>Terminal {user?.terminalId || '—'}</Text>
          </View>
        </View>

        <View style={styles.typeRowWrap}>
          {/* Both arrow slots stay mounted at all times (disabled + dimmed at
              the respective edge, rather than unmounted) so the ScrollView's
              viewport width never shifts as the user scrolls — same reasoning
              as ProductLifecycleScreen's tab row. */}
          <TouchableOpacity
            style={styles.typeArrowBtn}
            onPress={() => scrollTypesBy(-1)}
            disabled={!canScrollTypesLeft}
            accessibilityRole="button"
            accessibilityLabel={t('lifecyclePrevTabs')}
            accessibilityState={{ disabled: !canScrollTypesLeft }}
          >
            <View style={[styles.typeEdgeHint, !canScrollTypesLeft && styles.typeEdgeHintDisabled]}>
              <VectorIcon name="chevron-left" size={22} color={canScrollTypesLeft ? colors.primary : colors.placeholder} />
            </View>
          </TouchableOpacity>
          <ScrollView
            ref={typeScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeSelectorScroll}
            contentContainerStyle={styles.typeSelectorRow}
            onLayout={(e) => setTypeViewportWidth(e.nativeEvent.layout.width)}
            onContentSizeChange={(w) => setTypeContentWidth(w)}
            onScroll={(e) => setTypeScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={32}
          >
            {CAPTURE_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.typeChip, captureType === opt.key && styles.typeChipActive]}
                onPress={() => setCaptureType(opt.key)}
                activeOpacity={0.75}
              >
                <VectorIcon
                  name={opt.icon}
                  size={21}
                  color={captureType === opt.key ? '#fff' : colors.muted}
                  style={styles.typeChipIcon}
                />
                <Text style={[styles.typeChipText, captureType === opt.key && styles.typeChipTextActive]}>
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.typeArrowBtn}
            onPress={() => scrollTypesBy(1)}
            disabled={!canScrollTypesRight}
            accessibilityRole="button"
            accessibilityLabel={t('lifecycleNextTabs')}
            accessibilityState={{ disabled: !canScrollTypesRight }}
          >
            <View style={[styles.typeEdgeHint, !canScrollTypesRight && styles.typeEdgeHintDisabled]}>
              <VectorIcon name="chevron-right" size={22} color={canScrollTypesRight ? colors.primary : colors.placeholder} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.scanViewport}>
          {isCameraType ? renderCamera() : captureType === 'rfid' ? (
            <View style={styles.rfidPanel}>
              <View style={styles.rfidReaderTypeRow}>
                {RFID_READER_TYPES.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.rfidReaderChip, rfidReaderType === opt.key && styles.rfidReaderChipActive]}
                    onPress={() => {
                      setRfidReaderType(opt.key);
                      setRfidConnectError('');
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.rfidReaderChipText, rfidReaderType === opt.key && styles.rfidReaderChipTextActive]}>
                      {t(opt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Real/Simulate: both for Yometel; Impinj/Zebra only offer Simulate. */}
                <View style={styles.rfidModeColumn}>
                  {(rfidReaderType === 'yometel' ? (['real', 'simulate'] as RfidMode[]) : (['simulate'] as RfidMode[])).map((mode) => {
                    const selected = rfidReaderType === 'yometel' ? rfidMode === mode : true;
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={styles.rfidModeOption}
                        onPress={() => rfidReaderType === 'yometel' && handleRfidModeChange(mode)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <VectorIcon
                          name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                          size={18}
                          color={selected ? colors.primary : colors.muted}
                        />
                        <Text style={[styles.rfidModeText, selected && styles.rfidModeTextActive]} numberOfLines={1}>
                          {t(mode === 'real' ? 'rfidModeReal' : 'rfidModeSimulate')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {(() => {
                const readerId = user?.rfidReaderIds?.[rfidReaderType];
                const connected = rfidConnectedByType[rfidReaderType];
                if (!readerId) {
                  return (
                    <View style={styles.rfidStatusRow}>
                      <VectorIcon name="error-outline" size={22} color={colors.danger} />
                      <Text style={styles.rfidStatusText}>{t('rfidNoReaderAssigned')}</Text>
                    </View>
                  );
                }
                return (
                  <>
                    <View style={styles.rfidStatusRow}>
                      <View style={[styles.rfidStatusDot, connected ? styles.rfidStatusDotConnected : styles.rfidStatusDotDisconnected]} />
                      <Text style={styles.rfidStatusText} numberOfLines={1}>
                        {t('rfidReaderIdLabel')}: {readerId}
                      </Text>
                      <Text style={[styles.rfidStatusText, connected ? styles.rfidStatusTextConnected : undefined]}>
                        {connected ? t('rfidConnectedLabel') : t('rfidDisconnectedLabel')}
                      </Text>
                      {/* Tap to disconnect — mainly so a live demo can be
                          replayed from the first dummy tag without leaving
                          the screen (see dummyRevealIndexRef reset above). */}
                      {connected && (
                        <TouchableOpacity
                          onPress={handleDisconnectPress}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <VectorIcon name="bluetooth-disabled" size={20} color={colors.muted} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {!connected && (
                      <TouchableOpacity
                        style={[styles.rfidConnectButton, rfidConnecting && styles.rfidConnectButtonDisabled]}
                        onPress={handleConnectPress}
                        disabled={rfidConnecting}
                        activeOpacity={0.85}
                      >
                        {rfidConnecting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <VectorIcon name="bluetooth" size={20} color="#fff" />
                            <Text style={styles.rfidConnectButtonText}>{t('rfidConnectButton')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {!!rfidConnectError && !connected && (
                      <Text style={styles.rfidConnectErrorText}>{rfidConnectError}</Text>
                    )}
                  </>
                );
              })()}

              <View style={styles.rfidPassingCard}>
                <Text style={styles.rfidPassingHeading}>{t('rfidPassingTagsHeading')}</Text>
                {rfidTags.length === 0 ? (
                  <View style={styles.rfidPassingEmpty}>
                    <VectorIcon name="wifi-tethering" size={40} color={colors.muted} />
                    <Text style={[styles.rfidHintText, { marginTop: spacing.sm, textAlign: 'center' }]}>
                      {rfidReady ? t('corpRfidHint') : t('rfidConnectHint')}
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.rfidPassingList} showsVerticalScrollIndicator={false}>
                    {rfidTags.map((tag, index) => {
                      const dummy = DUMMY_RFID_TAGS.find((d) => d.epc === tag.epc);
                      const resolved = rfidProductByEpc[tag.epc];
                      const productId = resolved?.productId;
                      return (
                        <TouchableOpacity
                          key={`${tag.epc}-${tag.seenAt}`}
                          style={styles.rfidPassingRow}
                          activeOpacity={productId ? 0.7 : 1}
                          disabled={!productId}
                          onPress={() => setPreviewTag({ product: resolved?.product, productId, qrcodeId: resolved?.qrcodeId })}
                        >
                          {resolved?.productImage ? (
                            <Image source={{ uri: fileUrl(resolved.productImage) }} style={styles.rfidPassingIconBox} />
                          ) : (
                            <View style={styles.rfidPassingIconBox}>
                              <VectorIcon name="wifi-tethering" size={22} color={colors.primary} />
                            </View>
                          )}
                          <View style={styles.rfidPassingDetail}>
                            <Text style={styles.rfidPassingLabel} numberOfLines={1}>{dummy?.label || t('rfidUnknownTag')}</Text>
                            <Text style={styles.rfidPassingEpc} numberOfLines={1}>{tag.epc}</Text>
                          </View>
                          {index === 0 && (
                            <View style={styles.rfidNewBadge}>
                              <Text style={styles.rfidNewBadgeText}>{t('rfidLatestBadge')}</Text>
                            </View>
                          )}
                          {!!productId && <VectorIcon name="chevron-right" size={20} color={colors.muted} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <VectorIcon name="nfc" size={72} color="#fff" />
              <Text style={[styles.stateText, { marginTop: spacing.md }]}>
                {nfcAvailable ? t('corpNfcHint') : t('corpNfcUnavailable')}
              </Text>
            </View>
          )}
          {isCameraType && (
            <>
              <View pointerEvents="none" style={styles.frameOverlay}>
                <ScanFrameCorners size={240} active={!!liveCode} activeColor={colors.primary} />
              </View>
              <View pointerEvents="none" style={styles.overlayHintWrap}>
                <VectorIcon name="qr-code" size={24} color="#fff" style={styles.overlayHintIcon} />
                <Text style={styles.overlayHintText}>{t('corpScanHint')}</Text>
              </View>
              <View style={styles.overlayCornerRow}>
                <TouchableOpacity style={styles.overlayCornerButton} onPress={() => setTorchOn((v) => !v)} activeOpacity={0.75}>
                  <VectorIcon name={torchOn ? 'flash-on' : 'flash-off'} size={30} color="#fff" />
                  <Text style={styles.overlayCornerText}>{torchOn ? t('scanTorchOn') : t('scanTorchOff')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.overlayCornerButton} onPress={() => setHelpVisible(true)} activeOpacity={0.75}>
                  <VectorIcon name="help-outline" size={30} color="#fff" />
                  <Text style={styles.overlayCornerText}>{t('scanHelpLabel')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {isCameraType && cameraStalled && (
            <View style={styles.stalledOverlay}>
              <View style={styles.stalledCard}>
                <VectorIcon name="error-outline" size={42} color={colors.danger} />
                <Text style={styles.stalledTitle}>{t('scanCameraStalledTitle')}</Text>
                <Text style={styles.stalledBody}>{t('scanCameraStalledBody')}</Text>
                {Platform.OS !== 'web' && (
                  <GradientButton style={styles.stalledButton} onPress={forceFocusAndRetry} activeOpacity={0.85}>
                    <Text style={styles.stalledButtonText}>{t('scanForceFocus')}</Text>
                  </GradientButton>
                )}
                <TouchableOpacity style={styles.stalledSecondary} onPress={retryCamera} activeOpacity={0.8}>
                  <VectorIcon name="refresh" size={24} color={colors.primary} />
                  <Text style={styles.stalledSecondaryText}>{t('scanRetryCamera')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* RFID mode has no Recent Captures card — the Passing Tags card
            above already shows registered captures live, with product image
            and tap-through, so this section is skipped entirely rather than
            just hiding its button; scanViewport's flex:1 then fills the
            freed vertical space on its own. */}
        {captureType !== 'rfid' && (
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
                    {doc.imagePath ? (
                      <Image source={{ uri: `${API_BASE_URL.replace(/\/$/, '')}${doc.imagePath}` }} style={styles.thumbImage} />
                    ) : doc.identifierType === 'nfc' && (
                      <View style={styles.thumbTagIconBox}>
                        <VectorIcon name="nfc" size={30} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.thumbDetail}>
                      <Text style={styles.thumbIndex}>{index + 1}</Text>
                      <Text style={styles.thumbRef} numberOfLines={1}>{doc.refNumber}</Text>
                      {doc.imagePath ? (
                        <Text style={styles.thumbTime}>{new Date(doc.capturedAt).toLocaleTimeString()}</Text>
                      ) : (
                        <Text style={styles.thumbTime} numberOfLines={1}>{doc.rawValue}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {!!codeUnrecognized && !liveCode && (
              <Text style={styles.unrecognizedText}>{t('corpCodeUnrecognized')}</Text>
            )}

            <GradientButton
              style={[styles.captureButton, (!captureEnabled || capturing) && styles.captureButtonDisabled]}
              onPress={handleCapture}
              disabled={!captureEnabled || capturing}
            >
              {capturing || verifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <VectorIcon
                    name={captureType === 'nfc' ? 'nfc' : 'photo-camera'}
                    size={38}
                    color="#fff"
                  />
                  <Text style={styles.captureButtonText}>{t('corpCaptureButton')}</Text>
                </>
              )}
            </GradientButton>
          </View>
        )}
      </View>

      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <TouchableOpacity style={styles.helpOverlay} activeOpacity={1} onPress={() => setHelpVisible(false)}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>{t('scannerScanHint')}</Text>
            <Text style={styles.helpBody}>{t('scanHelpBody')}</Text>
            <GradientButton style={styles.helpCloseButton} onPress={() => setHelpVisible(false)} activeOpacity={0.8}>
              <Text style={styles.helpCloseButtonText}>{t('close')}</Text>
            </GradientButton>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tapping a registered Passing Tags row opens this instead of
          navigating away — same overlay/card idiom as the help dialog
          above, content modeled on the consumer ProductSummaryScreen's
          "initial info" subset (image, name, brand/type/color/size/
          material), sourced from the pmc/lookup result already cached in
          rfidProductByEpc when the tag was auto-captured. */}
      <Modal visible={!!previewTag} transparent animationType="fade" onRequestClose={() => setPreviewTag(null)}>
        <TouchableOpacity style={styles.helpOverlay} activeOpacity={1} onPress={() => setPreviewTag(null)}>
          {/* Inner touchable swallows taps so only the dim backdrop (or the
              close icon) dismisses — swiping the slider mustn't close it. */}
          <TouchableOpacity style={styles.previewCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={styles.previewCloseIcon}
              onPress={() => setPreviewTag(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <VectorIcon name="close" size={26} color={colors.muted} />
            </TouchableOpacity>
            {/* Same images-then-videos slider as the consumer Product Summary page. */}
            <View style={styles.previewMedia}>
              <MediaSlider
                images={Array.isArray(previewTag?.product?.images) ? previewTag.product.images : []}
                videos={Array.isArray(previewTag?.product?.videos) ? previewTag.product.videos : []}
                hideHeader
                flush
                maxHeight={180}
                getFileUrl={fileUrl}
              />
            </View>
            <Text style={styles.previewName} numberOfLines={2}>{previewTag?.product?.name || '—'}</Text>
            <View style={styles.previewVerifiedBadge}>
              <VectorIcon name="check-circle" size={18} color={colors.primary} />
              <Text style={styles.previewVerifiedText}>{t('overviewAuthenticated')}</Text>
            </View>
            <View style={styles.previewRows}>
              {[
                { label: t('summaryBrand'), value: previewTag?.product?.brandInfo?.name },
                { label: t('factProductType'), value: previewTag?.product?.productType },
                { label: t('factColor'), value: previewTag?.product?.color },
                { label: t('factSize'), value: previewTag?.product?.size },
                { label: t('summaryMaterial'), value: previewTag?.product?.detailFacts?.material },
              ].filter((row) => !!row.value).map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{row.value}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
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
  // numberOfLines={1} makes these size to the full cell width for ellipsis
  // purposes, so the parent's alignItems:'center' alone doesn't center the
  // glyphs inside — textAlign does.
  infoLabel: { fontSize: 17, color: colors.muted, textAlign: 'center' },
  infoValue: { fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center' },
  // Left/right chevron wrapper — same structure as ProductLifecycleScreen's
  // tabRowWrap: arrows are real flex siblings with a permanently reserved
  // MIN_TOUCH-wide slot each (disabled + dimmed at the respective edge
  // rather than unmounted), so the ScrollView's viewport width never shifts.
  typeRowWrap: { flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.sm },
  typeArrowBtn: { width: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  typeEdgeHint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  typeEdgeHintDisabled: { opacity: 0.35 },
  typeSelectorScroll: { flex: 1 },
  typeSelectorRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.xs },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 45,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipIcon: { marginRight: 4 },
  typeChipText: { fontSize: 18, color: colors.muted, fontWeight: '600' },
  typeChipTextActive: { color: '#fff' },
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
  stateText: { color: '#fff', fontSize: 20, textAlign: 'center', paddingHorizontal: spacing.lg },
  // White background specifically for the RFID panel (unlike the camera/NFC
  // dark viewport it sits inside) — fills scanViewport entirely, so its own
  // color wins regardless of the dark backgroundColor set on scanViewport.
  // Top-aligned (not centered) so the reader selector/status pack toward the
  // top and the passing-tags card below gets the rest of the height.
  rfidPanel: { flex: 1, width: '100%', justifyContent: 'flex-start', alignItems: 'stretch', padding: spacing.lg, backgroundColor: colors.surface },
  rfidReaderTypeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, alignSelf: 'center' },
  rfidModeColumn: { marginLeft: spacing.xs, justifyContent: 'center', gap: 2 },
  rfidModeOption: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rfidModeText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  rfidModeTextActive: { color: colors.primary, fontWeight: '700' },
  rfidReaderChip: {
    height: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    // Slightly tighter than before so three chips + the Real/Simulate
    // column fit on one row at phone width.
    paddingHorizontal: spacing.sm + 2,
  },
  rfidReaderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rfidReaderChipText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  rfidReaderChipTextActive: { color: '#fff' },
  rfidStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rfidStatusDot: { width: 10, height: 10, borderRadius: 5 },
  rfidStatusDotConnected: { backgroundColor: colors.success },
  rfidStatusDotDisconnected: { backgroundColor: '#8a94a6' },
  rfidStatusText: { fontSize: 18, color: colors.text },
  rfidStatusTextConnected: { color: colors.success, fontWeight: '600' },
  // Overrides stateText's white color (meant for the dark camera/NFC
  // viewport) back to a readable dark tone on the RFID panel's white bg.
  rfidHintText: { color: colors.muted },
  rfidConnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  rfidConnectButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  rfidConnectButtonDisabled: { opacity: 0.7 },
  rfidConnectErrorText: { color: colors.danger, fontSize: 15, marginBottom: spacing.md },
  // Live "tags passing near the reader" card — fills the rest of the RFID
  // panel's height below the reader selector/status, distinct from the
  // Recent Captures card further down (this shows detections, that shows
  // already-logged/registered captures).
  rfidPassingCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rfidPassingHeading: { fontSize: 17, fontWeight: '600', color: colors.muted, marginBottom: spacing.xs },
  rfidPassingEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rfidPassingList: { flex: 1 },
  rfidPassingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rfidPassingIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfidPassingDetail: { flex: 1, marginLeft: spacing.sm },
  rfidPassingLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  rfidPassingEpc: { fontSize: 13, color: colors.muted, marginTop: 1 },
  rfidNewBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginLeft: spacing.xs,
  },
  rfidNewBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
    fontSize: 20,
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
  overlayCornerButton: { alignItems: 'center', minWidth: 48, minHeight: 48, justifyContent: 'center' },
  overlayCornerText: {
    color: '#fff',
    fontSize: 17,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  thumbRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  thumbHeading: { fontSize: 21, fontWeight: '600', color: colors.muted },
  seeAllLink: { fontSize: 18, color: colors.muted },
  // Explicit height — without it a horizontal ScrollView with no flex:1
  // sibling can stretch its single-row content to fill leftover vertical
  // space, ballooning card height when there's only one capture to show.
  // Only rendered at all when there's at least one capture (see JSX) so an
  // empty step doesn't reserve this space between the header and Capture.
  thumbStrip: { height: 105, marginBottom: spacing.md },
  // Horizontal: image on the left, index (dark blue)/ref (gray)/time (gray)
  // stacked on the right.
  thumbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 225,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  thumbImage: { width: 66, height: 66, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbTagIconBox: {
    width: 66,
    height: 66,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDetail: { flex: 1, marginLeft: spacing.sm },
  thumbIndex: { fontSize: 20, fontWeight: '700', color: colors.primary },
  thumbRef: { fontSize: 15, fontWeight: '600', color: colors.muted, marginTop: 2 },
  thumbTime: { fontSize: 14, color: colors.muted },
  unrecognizedText: { color: colors.danger, fontSize: 18, textAlign: 'center', marginBottom: spacing.sm },
  captureButton: {
    // 1.3x smaller than the earlier 75 (75 / 1.3 ≈ 58) per explicit feedback.
    height: 58,
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
  captureButtonText: { color: '#fff', fontSize: 23, fontWeight: '600' },
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
  previewCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow(3),
  },
  // marginTop leaves a clear row for the absolutely-positioned close icon.
  previewCloseIcon: { position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 2, padding: 4 },
  previewMedia: { width: '100%', marginTop: spacing.lg, marginBottom: spacing.sm },
  previewName: { fontSize: 22, fontWeight: '700', color: colors.heading, marginBottom: spacing.xs, textAlign: 'center' },
  previewVerifiedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: spacing.md },
  previewVerifiedText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  previewRows: {},
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 16, color: colors.muted },
  detailValue: { fontSize: 16, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  stalledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,18,32,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stalledCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow(3),
  },
  stalledTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: colors.heading,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  stalledBody: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: spacing.lg,
  },
  stalledButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stalledButtonText: { color: '#fff', fontSize: 21, fontWeight: '700' },
  stalledSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  stalledSecondaryText: { color: colors.primary, fontSize: 20, fontWeight: '600' },
});
