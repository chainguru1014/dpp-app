import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Linking,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
  TextInput,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import { API_BASE_URL } from '../config/api';
import { CareSymbol, getCareSymbolLabel } from '../components/CareSymbols';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { colors, radius, spacing, shadow, gradients } from '../theme';

// Web QR Scanner
let QRCodeScanner: any = null;
let RNCamera: any = null;
if (Platform.OS !== 'web') {
  try {
    QRCodeScanner = require('react-native-qrcode-scanner').default;
    RNCamera = require('react-native-camera').RNCamera;
  } catch (e) {
    console.warn('QR scanner not available:', e);
  }
} else {
  // For web, we'll use a simple input or camera API
  try {
    const QrReader = require('react-qr-reader');
    QRCodeScanner = QrReader;
  } catch (e) {
    console.warn('Web QR reader not available');
  }
}

const { width } = Dimensions.get('window');

interface ResultScreenProps {
  route: any;
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

// Paged product-image slider with pagination dots — styled to match the home slider.
function ImageSlider({
  images,
  name,
  model,
  pmcCode,
  getFileUrl,
}: {
  images: string[];
  name?: string;
  model?: string;
  pmcCode?: string;
  getFileUrl: (filename: string) => string;
}) {
  const [pageWidth, setPageWidth] = useState(width);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const imageHeight = Math.min(Math.round((pageWidth - 32) * 1.1), 440);

  const onScroll = (e: any) => {
    if (!pageWidth) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (i !== active && i >= 0 && i < images.length) setActive(i);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
    setActive(i);
  };

  return (
    <View style={styles.topImageSliderContainer}>
      <View style={styles.sliderTextHeader}>
        <Text style={styles.productName}>{name || '—'}</Text>
        <Text style={styles.productModel}>{model || '—'}</Text>
        {!!pmcCode && <Text style={styles.pmcBadge}>ID: {pmcCode}</Text>}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== pageWidth) setPageWidth(w);
        }}
        style={styles.imageCarousel}
      >
        {images.map((img: string, index: number) => (
          <View key={`${img}-${index}`} style={[styles.slidePage, { width: pageWidth }]}>
            <View style={[styles.imageCard, { height: imageHeight }]}>
              <Image
                source={{ uri: getFileUrl(img) }}
                style={styles.carouselImageFull}
                resizeMode="contain"
              />
            </View>
          </View>
        ))}
      </ScrollView>

      {images.length > 1 && (
        <View style={styles.imageDots}>
          {images.map((_: string, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <View style={[styles.imageDot, active === i && styles.imageDotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ResultScreen({ route, navigation, user, onLogout }: ResultScreenProps) {
  const BRAND_COLOR = colors.primary;
  const FALLBACK_BRAND_NAME = 'Yometel';
  const FALLBACK_BRAND_DETAIL = 'Developing innovative "real-time and automatic" digital twins IoT /RFID technologies';
  const FALLBACK_BRAND_WEBSITE = 'https://www.yometel.jp/';
  const { t } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const [productData, setProductData] = useState<any>(route?.params?.productData || {});
  const [expandedSections, setExpandedSections] = useState<{ [key: number]: boolean }>({});
  const [showSecurityCheck, setShowSecurityCheck] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<'like' | 'dislike' | 'buy' | null>(null);
  // Buyer's transfer status for the current item, driving the primary button:
  // 'pending' (+ sent) → Requested, 'confirmed' → Owned, otherwise → Buy.
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  // Whether the request was actually sent (Send pressed) — a pending transfer is
  // also created just to mint the QR on Buy, which must NOT show "Requested".
  const [transferRequestSent, setTransferRequestSent] = useState(false);
  // Whether the share dialog should also email the link (checkbox).
  const [sendEmailChecked, setSendEmailChecked] = useState(false);
  const [selectedCareInfo, setSelectedCareInfo] = useState<{ label: string; description: string } | null>(null);
  const [brandLogoLoadFailed, setBrandLogoLoadFailed] = useState(false);
  const [isBrandFollowed, setIsBrandFollowed] = useState(false);
  const [isInAlbum, setIsInAlbum] = useState(false);
  const [showSalesDialog, setShowSalesDialog] = useState(false);
  const [showIntroduceDialog, setShowIntroduceDialog] = useState(false);
  const [showSendProductDialog, setShowSendProductDialog] = useState(false);
  const [showCopyInfoDialog, setShowCopyInfoDialog] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [friendContent, setFriendContent] = useState('');
  const [sendInfoEmail, setSendInfoEmail] = useState('');
  const [sendInfoContent, setSendInfoContent] = useState('');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferUrl, setTransferUrl] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [transferQrImage, setTransferQrImage] = useState('');
  const [transferEmail, setTransferEmail] = useState('');
  const [transferEmailSending, setTransferEmailSending] = useState(false);
  // The current owner of the item being purchased (shown in the share dialog).
  const [transferOwner, setTransferOwner] = useState<any>(null);
  // Owner-initiated transfer (for products the current user owns).
  const [showOwnerTransfer, setShowOwnerTransfer] = useState(false);
  const [otQuantity, setOtQuantity] = useState('1');
  const [otEmail, setOtEmail] = useState('');
  const [otMethod, setOtMethod] = useState<string>('sell');
  const [otLoading, setOtLoading] = useState(false);
  const [otConfirmNew, setOtConfirmNew] = useState(false);
  const [otError, setOtError] = useState('');
  const scannerRef = useRef<any>(null);
  const recordedScanSyncRef = useRef<string>('');

  const sections = [
    { id: 0, title: t('resultSectionProductDetails') },
    { id: 1, title: t('resultSectionCareLabel') },
    { id: 2, title: t('resultSectionMaterials') },
    { id: 3, title: t('resultSectionDispose') },
    { id: 4, title: t('resultSectionTraceabilityEsg') },
  ];

  const isAuthenticatedUser = !!user;
  // "Owner mode": opened from My Products for a product the user owns -> the Buy
  // action becomes a Transfer action.
  const isOwnedMode = !!route?.params?.owned;
  const ownedQuantity = route?.params?.ownedQuantity;
  const OWNER_TRANSFER_METHODS = ['sell', 'distribute', 'distribute_to_shop', 'export_to_country', 'export_to_store', 'export_to_shop', 'gift', 'lease', 'return', 'sale'];
  const availableContentMinHeight = Math.max(0, windowHeight - 70 - 70);

  useEffect(() => {
    setExpandedSections(isAuthenticatedUser ? { 0: true } : {});
  }, [isAuthenticatedUser]);

  useEffect(() => {
    const incomingProduct = route?.params?.productData;
    if (incomingProduct && Object.keys(incomingProduct).length > 0) {
      setProductData(incomingProduct);
    }
  }, [route?.params?.productData]);

  useEffect(() => {
    const syncVisitedProductToUserHistory = async () => {
      if (!user?._id || !productData?._id || productData?.token_id == null) return;
      const scanRef = String(productData?.scannedQRCode || `${productData?._id}:${productData?.token_id}`);
      if (!scanRef || recordedScanSyncRef.current === scanRef) return;
      recordedScanSyncRef.current = scanRef;
      try {
        await fetch(`${API_BASE_URL}qrcode/scan/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: productData._id,
            token_id: productData.token_id,
            encryptData: scanRef,
            user_id: user._id,
            source: 'visit',
          }),
        });
      } catch (error) {
        console.error('Failed to sync visited product scan record', error);
      }
    };
    syncVisitedProductToUserHistory();
  }, [user?._id, productData?._id, productData?.token_id, productData?.scannedQRCode]);

  useEffect(() => {
    setBrandLogoLoadFailed(false);
  }, [productData?._id, productData?.brandInfo?.logoUrl]);

  useEffect(() => {
    const productId = route?.params?.productId;
    const qrcodeId = route?.params?.qrcodeId;
    const shouldFetchByIds = !productData?._id && productId && qrcodeId != null;
    if (!shouldFetchByIds) return;

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}qrcode/public/${encodeURIComponent(String(productId))}/${encodeURIComponent(String(qrcodeId))}`);
        const data = await response.json();
        if (response.ok && data?.status === 'success') {
          setProductData(data.data || {});
        }
      } catch (error) {
        console.error('Failed to load public product data:', error);
      }
    })();
  }, [route?.params?.productId, route?.params?.qrcodeId, productData?._id]);

  const showLoginPrompt = () => {
    setShowJoinDialog(true);
  };

  const getPostLoginRedirect = () => {
    const productId = route?.params?.productId ?? productData?._id;
    const qrcodeId = route?.params?.qrcodeId ?? productData?.token_id;
    if (productId != null && productId !== '' && qrcodeId != null && qrcodeId !== '') {
      return {
        redirectTo: 'Result' as const,
        redirectParams: { productId: String(productId), qrcodeId: String(qrcodeId) },
      };
    }
    if (productData && Object.keys(productData).length > 0) {
      return { redirectTo: 'Result' as const, redirectParams: { productData } };
    }
    return { redirectTo: 'Home' as const, redirectParams: undefined };
  };

  const getSecurityStatusKey = () => {
    if (productData?.scannedQRCode) return `qr:${productData.scannedQRCode}`;
    if (productData?._id && productData?.token_id != null) return `token:${productData._id}-${productData.token_id}`;
    if (productData?._id) return `product:${productData._id}`;
    return '';
  };

  const persistSecurityPassed = async (passed: boolean) => {
    const key = getSecurityStatusKey();
    if (!key) return;
    try {
      const raw = await AsyncStorage.getItem('productSecurityCheckStatus');
      const map = raw ? JSON.parse(raw) : {};
      map[key] = passed;
      await AsyncStorage.setItem('productSecurityCheckStatus', JSON.stringify(map));
    } catch (error) {
      console.error('Error saving security check status:', error);
    }
  };

  useEffect(() => {
    const syncSecurityState = async () => {
      const key = getSecurityStatusKey();
      if (!key) return;

      if (route?.params?.securityPassed) {
        setIsAuthenticated(true);
        setShowSecurityCheck(false);
        await persistSecurityPassed(true);
        return;
      }

      try {
        const raw = await AsyncStorage.getItem('productSecurityCheckStatus');
        const map = raw ? JSON.parse(raw) : {};
        const passed = !!map[key];
        setIsAuthenticated(passed);
        setShowSecurityCheck(!passed);
      } catch (error) {
        console.error('Error loading security check status:', error);
      }
    };

    syncSecurityState();
  }, [route?.params?.securityPassed, productData?._id, productData?.token_id, productData?.scannedQRCode]);

  const toggleSection = (sectionId: number) => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSecurityCheck = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    const fallbackUrl = productData?.scannedQRCode
      || (productData?._id && productData?.token_id != null
        ? `${API_BASE_URL.replace(/\/$/, '')}/product/${encodeURIComponent(String(productData._id))}/${encodeURIComponent(String(productData.token_id))}`
        : '');

    if (!fallbackUrl) {
      Alert.alert(t('error'), t('failedToDecryptProduct'));
      return;
    }

    navigation.navigate('Scanner', {
      expectedSecurityQrUrl: fallbackUrl,
    });
  };

  const handleQRCodeScanned = (e: any) => {
    const qrData = e.data || e;
    // For now, just show authenticated message (API call skipped as per requirements)
    setShowCamera(false);
    setShowSecurityCheck(false);
    setIsAuthenticated(true);
    persistSecurityPassed(true);
    Alert.alert(t('productAuthenticatedSuccess'), t('productAuthenticatedMessage'));
  };

  const getProductFeedbackKey = () => {
    if (productData?.scannedQRCode) return `qr:${productData.scannedQRCode}`;
    if (productData?._id && productData?.token_id != null) return `token:${productData._id}-${productData.token_id}`;
    if (productData?._id) return `product:${productData._id}`;
    return '';
  };

  useEffect(() => {
    const loadFeedback = async () => {
      const key = getProductFeedbackKey();
      if (!key) return;
      try {
        if (user?._id && productData?._id && productData?.token_id != null) {
          const res = await fetch(
            `${API_BASE_URL}engagement/product-reaction?user_id=${encodeURIComponent(String(user._id))}&product_id=${encodeURIComponent(String(productData._id))}&token_id=${encodeURIComponent(String(productData.token_id))}`
          );
          const j = await res.json().catch(() => ({}));
          if (res.ok && j?.status === 'success') {
            const r = j?.reaction;
            if (r === 'like' || r === 'dislike' || r === 'buy') {
              setSelectedFeedback(r);
              return;
            }
            setSelectedFeedback(null);
            return;
          }
        }
        const raw = await AsyncStorage.getItem('scannedProductFeedback');
        const feedbackMap = raw ? JSON.parse(raw) : {};
        setSelectedFeedback(feedbackMap[key] || null);
      } catch (error) {
        console.error('Error loading product feedback:', error);
      }
    };
    loadFeedback();
  }, [user?._id, productData?._id, productData?.token_id, productData?.scannedQRCode]);

  // Track the buyer's transfer status for this item so the primary button shows
  // Buy → Requested (pending) → Owned (approved) / Buy (declined). Polls so the
  // owner's approve/decline reflects without a manual refresh.
  useEffect(() => {
    const uid = user?._id ? String(user._id) : '';
    const pid = productData?._id ? String(productData._id) : '';
    const token = productData?.token_id;
    if (!uid || !pid) {
      setTransferStatus(null);
      return;
    }
    let active = true;
    const fetchStatus = async () => {
      try {
        const tokenParam = token != null ? `&qrcode_id=${encodeURIComponent(String(token))}` : '';
        const res = await fetch(
          `${API_BASE_URL}transfer/buyer-status?product_id=${encodeURIComponent(pid)}&buyer_id=${encodeURIComponent(uid)}${tokenParam}`
        );
        const j = await res.json().catch(() => ({}));
        if (active && res.ok && j?.status === 'success') {
          setTransferStatus(j.transferStatus || null);
          setTransferRequestSent(!!j.requestSent);
        }
      } catch (e) {
        /* keep last value */
      }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [user?._id, productData?._id, productData?.token_id]);

  const persistProductReactionToServer = async (feedback: 'like' | 'dislike' | 'buy' | null) => {
    if (!user?._id || !productData?._id || productData?.token_id == null) return;
    try {
      const res = await fetch(`${API_BASE_URL}engagement/product-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user._id,
          product_id: productData._id,
          token_id: productData.token_id,
          reaction: feedback ?? '',
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.warn('Product reaction API failed', errBody);
      }
    } catch (error) {
      console.error('Error saving product reaction:', error);
    }
  };

  const updateProductFeedback = async (feedback: 'like' | 'dislike' | 'buy' | null) => {
    const key = getProductFeedbackKey();
    if (!key) return;
    try {
      const raw = await AsyncStorage.getItem('scannedProductFeedback');
      const feedbackMap = raw ? JSON.parse(raw) : {};
      if (feedback) {
        feedbackMap[key] = feedback;
      } else {
        delete feedbackMap[key];
      }
      await AsyncStorage.setItem('scannedProductFeedback', JSON.stringify(feedbackMap));
    } catch (error) {
      console.error('Error saving product feedback:', error);
    }
  };

  useEffect(() => {
    const syncMenuStatus = async () => {
      if (!user?._id || !productData?._id) {
        setIsBrandFollowed(false);
        setIsInAlbum(false);
        return;
      }
      const brand = getBrandInfo();
      try {
        const [followRes, albumRes] = await Promise.all([
          fetch(`${API_BASE_URL}engagement/follow/status?user_id=${encodeURIComponent(String(user._id))}&brandWebsiteUrl=${encodeURIComponent(brand.websiteUrl)}`),
          fetch(`${API_BASE_URL}engagement/album/status?user_id=${encodeURIComponent(String(user._id))}&product_id=${encodeURIComponent(String(productData._id))}&token_id=${encodeURIComponent(String(productData?.token_id ?? ''))}`),
        ]);
        const followJson = await followRes.json().catch(() => ({}));
        const albumJson = await albumRes.json().catch(() => ({}));
        setIsBrandFollowed(!!followJson?.following);
        setIsInAlbum(!!albumJson?.added);
      } catch (error) {
        console.error('Failed to load menu status', error);
      }
    };
    syncMenuStatus();
  }, [user?._id, productData?._id, productData?.token_id, productData?.brandInfo?.websiteUrl]);

  const handleLike = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    setSelectedFeedback((prev) => {
      const next = prev === 'like' ? null : 'like';
      updateProductFeedback(next);
      persistProductReactionToServer(next);
      return next;
    });
  };

  const handleDislike = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    setSelectedFeedback((prev) => {
      const next = prev === 'dislike' ? null : 'dislike';
      updateProductFeedback(next);
      persistProductReactionToServer(next);
      return next;
    });
  };

  const handleBuy = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    // Record the buy reaction + purchase history (unchanged behavior).
    setSelectedFeedback('buy');
    updateProductFeedback('buy');
    persistProductReactionToServer('buy');
    if (user?._id && productData?._id) {
      fetch(`${API_BASE_URL}engagement/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user._id,
          product_id: productData._id,
          token_id: productData?.token_id ?? null,
          productSnapshot: getProductSnapshot(),
        }),
      }).catch((error) => console.error('Failed to add purchase history', error));
    }
    // Open the ownership-transfer share dialog (QR + link + email).
    initiateTransfer();
  };

  // Ask the backend to create (or reuse) a pending ownership-transfer request,
  // then show its QR code / link for the current owner to scan and confirm.
  const initiateTransfer = async () => {
    if (!user?._id || !productData?._id) return;
    setShowTransferDialog(true);
    setTransferLoading(true);
    setTransferUrl('');
    setTransferCode('');
    setTransferQrImage('');
    setTransferEmail('');
    try {
      const response = await fetch(`${API_BASE_URL}transfer/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productData._id,
          buyer_id: user._id,
          qrcode_id: productData?.token_id ?? null,
          method: 'sale',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to start transfer');
      }
      setTransferUrl(result.url || '');
      setTransferCode(result.code || '');
      setTransferQrImage(result.qrImage || '');
      setTransferOwner(result.owner || result.transfer?.from_owner || null);
    } catch (error: any) {
      Alert.alert(t('error'), error?.message || 'Failed to start transfer');
      setShowTransferDialog(false);
    } finally {
      setTransferLoading(false);
    }
  };

  const sendTransferEmail = async () => {
    if (!transferCode) {
      Alert.alert(t('error'), 'Transfer is not ready yet');
      return;
    }
    // Email is optional — only validate/send it when the checkbox is on.
    if (sendEmailChecked && !isValidEmail(transferEmail)) {
      Alert.alert(t('error'), 'Please enter a valid email address');
      return;
    }
    setTransferEmailSending(true);
    try {
      // Optionally email the branded confirmation link (embeds QR + button).
      if (sendEmailChecked) {
        const response = await fetch(`${API_BASE_URL}transfer/share-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toEmail: transferEmail, code: transferCode }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.status !== 'success') {
          throw new Error(result?.message || 'Failed to send email');
        }
      }
      // Always send the in-app purchase request to the product item's owner so
      // they can accept or decline it from their app / admin panel.
      const notifyRes = await fetch(`${API_BASE_URL}transfer/${encodeURIComponent(transferCode)}/notify-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const notifyData = await notifyRes.json().catch(() => ({}));
      if (!notifyRes.ok || notifyData?.status !== 'success') {
        throw new Error(notifyData?.message || 'Failed to send request');
      }
      // Success: lock the button to "Requested", close the dialog, confirm.
      setTransferEmail('');
      setTransferStatus('pending');
      setTransferRequestSent(true);
      setShowTransferDialog(false);
      const notified = notifyData?.notified !== false;
      Alert.alert(
        t('success'),
        notified
          ? sendEmailChecked
            ? 'Your purchase request has been sent to the owner and the email was delivered.'
            : 'Your purchase request has been sent to the owner.'
          : 'Your request was recorded, but this product has no registered owner account to notify in-app.'
      );
    } catch (error: any) {
      Alert.alert(t('error'), error?.message || 'Failed to send purchase request');
    } finally {
      setTransferEmailSending(false);
    }
  };

  // Cancelling the dialog without sending withdraws the pending request that
  // "Buy" created (to produce the QR), so the button returns to "Buy".
  const cancelTransferRequest = async () => {
    setShowTransferDialog(false);
    setSendEmailChecked(false);
    if (transferCode && user?._id) {
      try {
        await fetch(`${API_BASE_URL}transfer/${encodeURIComponent(transferCode)}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor: { kind: 'User', id: String(user._id) } }),
        });
      } catch (e) {
        /* best-effort */
      }
      setTransferStatus(null);
    }
  };

  // --- Owner-initiated transfer (the Transfer button on an owned product) ---
  const openOwnerTransfer = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    setOtQuantity('1');
    setOtEmail('');
    setOtMethod('sell');
    setOtError('');
    setOtConfirmNew(false);
    setShowOwnerTransfer(true);
  };

  const performOwnerTransfer = async () => {
    setOtLoading(true);
    setOtError('');
    try {
      const response = await fetch(`${API_BASE_URL}transfer/owner-initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productData._id,
          actor: { kind: user?.actorKind || 'User', id: user?._id },
          quantity: Number(otQuantity),
          method: otMethod,
          receiver_email: otEmail.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || t('error'));
      }
      setShowOwnerTransfer(false);
      setOtConfirmNew(false);
      Alert.alert(
        t('success'),
        result.recipientRegistered ? t('transferSuccessMsg') : t('inviteSentMsg'),
        [{ text: t('ok'), onPress: () => navigation.navigate('ScannedProducts') }]
      );
    } catch (error: any) {
      setOtError(error?.message || t('error'));
      setOtConfirmNew(false);
    } finally {
      setOtLoading(false);
    }
  };

  const submitOwnerTransfer = async () => {
    setOtError('');
    const q = Number(otQuantity);
    const maxQ = ownedQuantity != null ? Number(ownedQuantity) : undefined;
    if (!q || q < 1) {
      setOtError('Enter a quantity of at least 1.');
      return;
    }
    if (maxQ != null && q > maxQ) {
      setOtError(`You only own ${maxQ} unit(s).`);
      return;
    }
    if (!isValidEmail(otEmail)) {
      setOtError('Enter a valid receiver email address.');
      return;
    }
    setOtLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}transfer/recipient?email=${encodeURIComponent(otEmail.trim())}`);
      const json = await res.json().catch(() => ({}));
      setOtLoading(false);
      if (json?.exists) {
        await performOwnerTransfer();
      } else {
        setOtConfirmNew(true);
      }
    } catch (error: any) {
      setOtLoading(false);
      setOtError(error?.message || t('error'));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      const nav = (globalThis as any)?.navigator;
      if (Platform.OS === 'web' && nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
      } else {
        await Clipboard.setString(text);
      }
      setShowCopyInfoDialog(true);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      Alert.alert(t('error'), 'Could not copy to clipboard');
    }
  };

  const saveProductInfoToDoc = async (content: string) => {
    const webGlobal = globalThis as any;
    if (Platform.OS === 'web' && webGlobal?.document && webGlobal?.Blob && webGlobal?.URL) {
      const blob = new webGlobal.Blob([content], { type: 'application/msword' });
      const url = webGlobal.URL.createObjectURL(blob);
      const a = webGlobal.document.createElement('a');
      a.href = url;
      a.download = `${(productData?.name || 'product-info').replace(/[^a-z0-9-_]+/gi, '_')}.doc`;
      webGlobal.document.body.appendChild(a);
      a.click();
      webGlobal.document.body.removeChild(a);
      webGlobal.URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ message: content, title: 'Product info' });
  };

  const handleActionMenuPress = async (actionKey: string) => {
    const brand = getBrandInfo();
    const infoText = buildProductInfoText();
    const requireLoginFor = ['toggleAlbum', 'toggleFollowBrand'];
    if (requireLoginFor.includes(actionKey) && !user?._id) {
      showLoginPrompt();
      return;
    }

    try {
      switch (actionKey) {
        case 'connectBrand':
          openBrandWebsite(brand.websiteUrl);
          break;
        case 'connectSalesPerson':
          setShowSalesDialog(true);
          break;
        case 'toggleFollowBrand': {
          const method = isBrandFollowed ? 'DELETE' : 'POST';
          const res = await fetch(`${API_BASE_URL}engagement/follow`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user._id,
              brandWebsiteUrl: brand.websiteUrl,
              brandName: brand.name,
              brandDetail: brand.detail,
              brandLogoUrl: brand.logoRaw || '',
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Failed');
          setIsBrandFollowed(!isBrandFollowed);
          break;
        }
        case 'toggleAlbum': {
          const method = isInAlbum ? 'DELETE' : 'POST';
          const res = await fetch(`${API_BASE_URL}engagement/album`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user._id,
              product_id: productData?._id,
              token_id: productData?.token_id ?? null,
              productSnapshot: getProductSnapshot(),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.status !== 'success') throw new Error(data?.message || 'Failed');
          setIsInAlbum(!isInAlbum);
          break;
        }
        case 'introduceBrandToFriend':
          setFriendEmail('');
          setFriendContent(
            `Brand Name: ${brand.name}\nBrand Detail: ${brand.detail}\nBrand Website URL: ${brand.websiteUrl}`
          );
          setShowIntroduceDialog(true);
          break;
        case 'saveProductInfo':
          await saveProductInfoToDoc(infoText);
          break;
        case 'copyProductInfo':
          await copyToClipboard(infoText);
          break;
        case 'sendProductInfo':
          setSendInfoEmail('');
          setSendInfoContent(infoText);
          setShowSendProductDialog(true);
          break;
        default:
          break;
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Action failed');
    }
  };

  const getFileUrl = (filename: string) => {
    if (!filename) {
      console.warn('getFileUrl: filename is empty');
      return '';
    }
    
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    
    if (filename.startsWith('/files/')) {
      return `${API_BASE_URL}${filename.substring(1)}`;
    }
    
    const cleanFilename = filename.startsWith('/') ? filename.substring(1) : filename;
    return `${API_BASE_URL}files/${cleanFilename}`;
  };

  const getYoutubeVideoID = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&]+)/);
    return match ? match[1] : null;
  };

  const normalizeToStringArray = (value: any): string[] => {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value.flatMap((item: any) => normalizeToStringArray(item));
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (typeof value === 'object') {
      return Object.values(value).flatMap((item: any) => normalizeToStringArray(item));
    }
    return [];
  };

  const normalizeToArray = (value: any): any[] => {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return Object.values(value);
    return [value];
  };

  const getCareInstruction = (iconId: string, fallbackLabel: string) => {
    const careInstructions: Record<string, string> = {
      wash_30: 'Wash at a maximum temperature of 30°C.',
      wash_40: 'Wash at a maximum temperature of 40°C.',
      wash_50: 'Wash at a maximum temperature of 50°C.',
      wash_60: 'Wash at a maximum temperature of 60°C.',
      wash_70: 'Wash at a maximum temperature of 70°C.',
      dry_clean_P: 'Professional dry clean with perchloroethylene allowed.',
      dry_clean_F: 'Professional dry clean with hydrocarbon solvents only.',
      iron_low: 'Iron at low temperature (max 110°C).',
      iron_med: 'Iron at medium temperature (max 150°C).',
      iron_high: 'Iron at high temperature (max 200°C).',
      bleach_no: 'Do not bleach.',
      bleach_any: 'Bleach with any oxidizing agent allowed.',
      tumble_dry_low: 'Tumble dry at low heat.',
      tumble_dry_high: 'Tumble dry at high heat.',
    };
    return careInstructions[iconId] || `${fallbackLabel}.`;
  };

  const getBrandInfo = () => {
    const info = productData?.brandInfo || {};
    const name = String(info.name || '').trim() || FALLBACK_BRAND_NAME;
    const detail = String(info.detail || '').trim() || FALLBACK_BRAND_DETAIL;
    const websiteUrl = String(info.websiteUrl || '').trim() || FALLBACK_BRAND_WEBSITE;
    const logoRaw = String(info.logoUrl || '').trim();
    return { name, detail, websiteUrl, logoRaw };
  };

  const openBrandWebsite = (websiteUrl: string) => {
    const sanitizedUrl = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
    if (Platform.OS === 'web') {
      (globalThis as any)?.open?.(sanitizedUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(sanitizedUrl);
  };

  const buildProductInfoText = () => {
    const brand = getBrandInfo();
    const maintenance = productData?.maintenance || { iconIds: [], description: '' };
    const materialSize = productData?.materialSize || { size: '', materials: [] };
    const disposal = productData?.disposal || {};
    const traceability = productData?.traceabilityEsg || {};
    const iconIds = normalizeToStringArray(maintenance.iconIds);
    const careLines = iconIds.map((id: string) => `${getCareSymbolLabel(id)}: ${getCareInstruction(id, getCareSymbolLabel(id))}`);
    const materials = normalizeToArray(materialSize.materials).map((row: any) => `${row.material || '-'} ${row.percent != null ? `${row.percent}%` : ''}`);
    return [
      `Product Name: ${productData?.name || '-'}`,
      `Model: ${productData?.model || '-'}`,
      '',
      `Product Detail: ${String(productData?.detail || '').trim() || '-'}`,
      '',
      `Brand Name: ${brand.name}`,
      `Brand Detail: ${brand.detail}`,
      `Brand Website: ${brand.websiteUrl}`,
      '',
      'Care Label:',
      careLines.length ? careLines.join('\n') : '-',
      maintenance.description ? `Description: ${maintenance.description}` : '',
      '',
      `Material/Size: ${materialSize.size || '-'}`,
      materials.length ? materials.join('\n') : '-',
      '',
      'Dispose:',
      `Repair URL: ${disposal.repairUrl || '-'}`,
      `Reuse URL: ${disposal.reuseUrl || '-'}`,
      `Rental URL: ${disposal.rentalUrl || '-'}`,
      `Dispose URL: ${disposal.disposeUrl || '-'}`,
      '',
      'Traceability/ESG:',
      `Made in: ${traceability.madeIn || '-'}`,
      `Shipping: ${traceability.shippingLog || '-'}`,
      `Distance: ${traceability.distance || '-'}`,
      `CO2 Production: ${traceability.co2Production || '-'}`,
      `CO2 Transportation: ${traceability.co2Transportation || '-'}`,
    ].filter(Boolean).join('\n');
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

  const sendEmailContent = async (toEmail: string, content: string, subject: string) => {
    const response = await fetch(`${API_BASE_URL}engagement/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail, content, subject }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.status !== 'success') {
      throw new Error(result?.message || 'Failed to send email');
    }
  };

  const getProductSnapshot = () => ({
    name: productData?.name || '',
    model: productData?.model || '',
    detail: productData?.detail || '',
    images: normalizeToStringArray(productData?.images),
    brandInfo: getBrandInfo(),
  });

  const renderProductDetails = () => {
    const videos = normalizeToArray(productData?.videos);
    const files = normalizeToStringArray(productData?.files);
    const detail = String(productData?.detail ?? '').trim();
    const brandInfo = getBrandInfo();
    const logoSource = !brandLogoLoadFailed && brandInfo.logoRaw
      ? {
          uri: /^https?:\/\//i.test(brandInfo.logoRaw)
            ? brandInfo.logoRaw
            : getFileUrl(brandInfo.logoRaw),
        }
      : require('../assets/logo.jpg');

    return (
      <View style={styles.sectionContent}>
        <View style={styles.productDetailMainRow}>
          <View style={styles.productDetailLeftPane}>
            {detail ? (
              <View style={styles.detailContainer}>
                <Text style={styles.detailText}>{detail}</Text>
              </View>
            ) : (
              <View style={styles.detailContainer}>
                <Text style={styles.detailText}>—</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.brandCard}
            activeOpacity={0.8}
            onPress={() => openBrandWebsite(brandInfo.websiteUrl)}
          >
            <Image
              source={logoSource}
              style={styles.brandLogoImage}
              resizeMode="contain"
              onError={() => setBrandLogoLoadFailed(true)}
            />
            <Text style={styles.brandNameText}>{brandInfo.name}</Text>
          </TouchableOpacity>
        </View>

        {videos.length > 0 && (
          <View style={styles.videosContainer}>
            {videos.map((video: any, index: number) => {
              const videoId = getYoutubeVideoID(video?.url);
              if (!videoId) return null;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.videoButton}
                  onPress={() => Linking.openURL(video.url)}
                >
                  <Icon name="play-circle-filled" size={24} color={BRAND_COLOR} />
                  <Text style={styles.videoText}>{video.description || t('watchVideo')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {files.length > 0 && (
          <View style={styles.filesContainer}>
            {files.map((file: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.fileButton}
                onPress={() => Linking.openURL(getFileUrl(file))}
              >
                <Icon name="description" size={24} color={BRAND_COLOR} />
                <Text style={styles.fileText}>{file}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderCareLabel = () => {
    const maintenance = productData?.maintenance || { iconIds: [], description: '' };
    const iconIds = normalizeToStringArray(maintenance.iconIds);
    
    return (
      <View style={styles.sectionContent}>
        <Text style={styles.careSymbolsLabel}>{t('careSymbolsSelected')}</Text>
        {iconIds.length > 0 ? (
          <View style={styles.careSymbolsContainer}>
            {iconIds.map((id: string, index: number) => {
              const label = getCareSymbolLabel(id);
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.careSymbolBox}
                  activeOpacity={0.8}
                  onPress={() =>
                    setSelectedCareInfo({
                      label,
                      description: getCareInstruction(id, label),
                    })
                  }
                >
                  <CareSymbol iconId={id} selected={true} />
                  <Text style={styles.careSymbolLabel}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.noDataText}>{t('noCareSymbolsSelected')}</Text>
        )}
        {maintenance.description && (
          <Text style={styles.maintenanceDescription}>{maintenance.description}</Text>
        )}
        <View style={styles.dppInfoBox}>
          <Text style={styles.dppTitle}>{t('dppLabel')}</Text>
          <Text style={styles.dppText}>{t('dppTraceability')}</Text>
          <Text style={styles.dppText}>{t('dppMorePunchy')}</Text>
          <Text style={styles.dppText}>{t('dppSupplyChain')}</Text>
        </View>
      </View>
    );
  };

  const renderMaterials = () => {
    const materialSize = productData?.materialSize || { size: '', materials: [] };
    const materials = normalizeToArray(materialSize.materials);
    
    return (
      <View style={styles.sectionContent}>
        <Text style={styles.sectionText}>
          {t('sizeColon')} : {materialSize.size || '—'}
        </Text>
        {productData?._id && (
          <Text style={styles.productIdText}>{t('productIdColon')}: {productData._id}</Text>
        )}
        {materials.map((row: any, i: number) => (
          <Text key={i} style={styles.materialText}>
            {row.material || '—'} {row.percent != null ? `${row.percent}%` : ''}
          </Text>
        ))}
      </View>
    );
  };

  const renderDispose = () => {
    const disposal = productData?.disposal || { repairUrl: '', reuseUrl: '', rentalUrl: '', disposeUrl: '' };
    
    return (
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitleBlue}>{t('urlLabel')}</Text>
        <View style={styles.disposalLinksContainer}>
          {disposal.repairUrl && (
            <View style={styles.disposalLinkRow}>
              <Text style={styles.disposalLabel}>{t('repairLink')} </Text>
              <Text
                style={styles.disposalLink}
                onPress={() => Linking.openURL(disposal.repairUrl)}
              >
                {t('repairLink')}
              </Text>
            </View>
          )}
          {disposal.reuseUrl && (
            <View style={styles.disposalLinkRow}>
              <Text style={styles.disposalLabel}>{t('reuseLink')} </Text>
              <Text
                style={styles.disposalLink}
                onPress={() => Linking.openURL(disposal.reuseUrl)}
              >
                {t('reuseLink')}
              </Text>
            </View>
          )}
          {disposal.rentalUrl && (
            <View style={styles.disposalLinkRow}>
              <Text style={styles.disposalLabel}>{t('rentalLink')} </Text>
              <Text
                style={styles.disposalLink}
                onPress={() => Linking.openURL(disposal.rentalUrl)}
              >
                {t('rentalLink')}
              </Text>
            </View>
          )}
          {disposal.disposeUrl && (
            <View style={styles.disposalLinkRow}>
              <Text style={styles.disposalLabel}>{t('disposeLink')} </Text>
              <Text
                style={styles.disposalLink}
                onPress={() => Linking.openURL(disposal.disposeUrl)}
              >
                {t('disposeLink')}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.environmentBox}>
          <Text style={styles.environmentText}>{t('reduceDisposal')}</Text>
          <Text style={styles.environmentText}>{t('saveEnvironment')}</Text>
        </View>
        <Text style={styles.inquiryLabel}>{t('inquiry')}</Text>
        <Text
          style={styles.inquiryLink}
          onPress={() => Linking.openURL('https://www.Yometel.com')}
        >
          https://www.Yometel.com
        </Text>
      </View>
    );
  };

  const renderTraceability = () => {
    const traceabilityEsg = productData?.traceabilityEsg || {
      madeIn: '',
      materialOrigins: [],
      shippingLog: '',
      distance: '',
      co2Production: '',
      co2Transportation: '',
    };
    
    const materialOrigins = normalizeToArray(traceabilityEsg.materialOrigins);

    return (
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitleBlue}>{t('madeIn')}</Text>
        <Text style={styles.sectionText}>{traceabilityEsg.madeIn || '—'}</Text>
        
        <Text style={[styles.sectionTitleBlue, styles.marginTop]}>{t('materialOrigins')}</Text>
        {materialOrigins.map((row: any, i: number) => (
          <Text key={i} style={styles.sectionText}>
            {row.material || '—'} {row.companyName || ''}
          </Text>
        ))}
        
        <Text style={[styles.sectionTitleBlue, styles.marginTop]}>{t('shipping')}</Text>
        <Text style={styles.sectionText}>{traceabilityEsg.shippingLog || '—'}</Text>
        
        <Text style={[styles.sectionTitleBlue, styles.marginTop]}>{t('distance')}</Text>
        <Text style={styles.sectionText}>{traceabilityEsg.distance || '—'}</Text>
        
        <Text style={[styles.sectionTitleBlue, styles.marginTop]}>{t('co2Production')}</Text>
        <Text style={styles.sectionText}>{traceabilityEsg.co2Production || '—'}</Text>
        
        <Text style={[styles.sectionTitleBlue, styles.marginTop]}>{t('co2Transportation')}</Text>
        <Text style={styles.sectionText}>{traceabilityEsg.co2Transportation || '—'}</Text>
      </View>
    );
  };

  const renderSectionContent = (sectionId: number) => {
    switch (sectionId) {
      case 0:
        return renderProductDetails();
      case 1:
        return renderCareLabel();
      case 2:
        return renderMaterials();
      case 3:
        return renderDispose();
      case 4:
        return renderTraceability();
      default:
        return null;
    }
  };

  const renderImageSlider = () => {
    const images = normalizeToStringArray(productData?.images);
    if (images.length === 0) return null;

    return (
      <ImageSlider
        images={images}
        name={productData?.name}
        model={productData?.model}
        pmcCode={productData?.pmc_code}
        getFileUrl={getFileUrl}
      />
    );
  };

  const renderQRScanner = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.cameraContainer}>
          <Text style={styles.cameraPlaceholder}>{t('qrScannerWebImpl')}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              // Simulate QR scan for web
              handleQRCodeScanned({ data: 'mock-qr-data' });
            }}
          >
            <Text style={styles.buttonText}>{t('simulateScan')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#666', marginTop: 10 }]}
            onPress={() => setShowCamera(false)}
          >
            <Text style={styles.buttonText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!QRCodeScanner || !RNCamera) {
      return (
        <View style={styles.cameraContainer}>
          <Text style={styles.cameraPlaceholder}>{t('cameraNotAvailable')}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setShowCamera(false)}
          >
            <Text style={styles.buttonText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <QRCodeScanner
          ref={scannerRef}
          onRead={handleQRCodeScanned}
          reactivate={true}
          reactivateTimeout={3000}
          showMarker={true}
          cameraStyle={styles.camera}
          topContent={
            <View style={styles.topContent}>
              <Text style={styles.centerText}>
                {t('scannerAuthHint')}
              </Text>
            </View>
          }
          bottomContent={
            <View style={styles.bottomContent}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.buttonText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          }
          cameraProps={{
            flashMode: RNCamera.Constants.FlashMode.auto,
          }}
        />
      </View>
    );
  };

  const ownerInfo = {
    name: String(productData?.ownerInfo?.name || productData?.company?.name || '').trim(),
    email: String(productData?.ownerInfo?.email || productData?.company?.email || '').trim(),
    phoneNumber: String(productData?.ownerInfo?.phoneNumber || productData?.company?.phoneNumber || '').trim(),
    address: String(productData?.ownerInfo?.address || productData?.company?.location || '').trim(),
  };

  const copyFieldValue = async (value: string) => {
    if (!value) return;
    try {
      await copyToClipboard(value);
    } catch {
      Alert.alert('Error', 'Failed to copy');
    }
  };

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={isAuthenticatedUser}
      onBackPress={
        isAuthenticatedUser
          ? () => navigation.navigate(route?.params?.returnTo || 'Home')
          : undefined
      }
      hideBottomBar={false}
      onGuestAction={showLoginPrompt}
      onActionMenuPress={handleActionMenuPress}
      isBrandFollowed={isBrandFollowed}
      isInAlbum={isInAlbum}
      useActionMenuCenter={true}
      isProductDetailPage={true}
    >
      <ScrollView
        style={[styles.content, Platform.OS === 'web' && { minHeight: availableContentMinHeight }]}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'web' && { minHeight: availableContentMinHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {!productData || Object.keys(productData).length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.noDataText}>{t('failedToDecryptProduct')}</Text>
          </View>
        ) : null}

        {renderImageSlider()}

        {/* Security Check Button or Authenticated Message */}
        <View style={styles.securityCheckContainer}>
          {showSecurityCheck && !isAuthenticated ? (
            <TouchableOpacity
              style={[styles.securityCheckButton, gradients.accent]}
              onPress={handleSecurityCheck}
            >
              <Image source={require('../assets/shield.png')} style={[styles.actionIcon, { tintColor: '#fff' }]} />
              <Text style={styles.securityCheckText}>{t('securityCheck')}</Text>
            </TouchableOpacity>
          ) : isAuthenticated ? (
            <View style={styles.authenticatedContainer}>
              <View style={styles.authenticatedIcon}>
                <Image source={require('../assets/insurance.png')} style={styles.authenticatedStatusIcon} />
              </View>
              <Text style={styles.authenticatedTitle}>{t('productIdAuthenticatedTitle')}</Text>
              <Text style={styles.authenticatedText}>
                {t('authRecordedLine1')}
              </Text>
              <Text style={styles.authenticatedText}>
                {t('authRecordedLine2')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Primary action: Buy (or Transfer when the user owns this product).
            The buy state follows the transfer: Buy → Requested (pending) →
            Owned (approved); a declined/none request stays Buy. */}
        {(() => {
          const isPending = !isOwnedMode && transferStatus === 'pending' && transferRequestSent;
          const isOwned = !isOwnedMode && transferStatus === 'confirmed';
          const buyLocked = isPending || isOwned;
          const label = isOwnedMode
            ? t('transferButton')
            : isPending
            ? t('requested')
            : isOwned
            ? t('owned')
            : t('buy');
          return (
        <TouchableOpacity
          style={[
            styles.primaryActionButton,
            isOwnedMode && styles.primaryActionButtonTransfer,
            buyLocked && styles.primaryActionButtonDisabled,
          ]}
          onPress={isOwnedMode ? openOwnerTransfer : handleBuy}
          activeOpacity={0.85}
          disabled={buyLocked}
        >
          <Image
            source={isOwnedMode ? require('../assets/connection.png') : require('../assets/cart.png')}
            style={styles.primaryActionIcon}
          />
          <Text style={styles.primaryActionText}>
            {label}
          </Text>
          {isOwnedMode && ownedQuantity != null && (
            <Text style={styles.primaryActionBadge}>{`× ${ownedQuantity}`}</Text>
          )}
        </TouchableOpacity>
          );
        })()}

        {/* Secondary feedback: Like / Dislike */}
        <View style={styles.likeDislikeContainer}>
          <TouchableOpacity
            style={[styles.likeDislikeButton, selectedFeedback === 'like' && styles.likeDislikeButtonActive]}
            onPress={handleLike}
          >
            <Image source={require('../assets/like.png')} style={styles.actionIcon} />
            <Text style={[styles.likeDislikeText, selectedFeedback === 'like' && styles.likeDislikeTextActive]}>
              {t('like')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.likeDislikeButton, selectedFeedback === 'dislike' && styles.likeDislikeButtonDisliked]}
            onPress={handleDislike}
          >
            <Image source={require('../assets/dislike.png')} style={styles.actionIcon} />
            <Text style={[styles.likeDislikeText, selectedFeedback === 'dislike' && styles.likeDislikeTextActive]}>
              {t('dislike')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Accordion Sections */}
        {sections.map((section) => (
          <View key={section.id} style={styles.accordionSection}>
            <TouchableOpacity
              style={[styles.accordionHeader, gradients.header]}
              onPress={() => toggleSection(section.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.accordionHeaderText}>{section.title}</Text>
              <View style={styles.accordionToggleBadge}>
                <Icon
                  name={expandedSections[section.id] ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={22}
                  color={'#fff'}
                />
              </View>
            </TouchableOpacity>
            {expandedSections[section.id] && (
              <View style={styles.accordionContent}>
                {section.id === 0 ? renderProductDetails() : renderSectionContent(section.id)}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {/* Keep modal outside ScrollView to avoid RN web content-layer paint issues */}
      <Modal
        visible={showCamera}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        {renderQRScanner()}
      </Modal>
      <Modal
        visible={showJoinDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinDialog(false)}
      >
        <View style={styles.joinModalOverlay}>
          <View style={styles.joinModalCard}>
            <Text style={styles.joinModalText}>Please sign in to continue</Text>
            {/* Sign-in now doubles as sign-up: Google/Apple/email-OTP
                find-or-create the account, so there's no separate
                "create account" entry point anymore — Register requires a
                bearer token from a completed auth step and is no longer a
                valid destination for a signed-out user. */}
            <TouchableOpacity
              style={styles.joinModalButton}
              onPress={() => {
                setShowJoinDialog(false);
                const { redirectTo, redirectParams } = getPostLoginRedirect();
                navigation.navigate('Login', { redirectTo, redirectParams });
              }}
            >
              <Text style={styles.joinModalButtonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowJoinDialog(false)}>
              <Text style={styles.joinModalCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showTransferDialog}
        transparent
        animationType="fade"
        onRequestClose={cancelTransferRequest}
      >
        <View style={styles.careModalOverlay}>
          <View style={styles.emailDialogCard}>
            <Text style={styles.careModalTitle}>{t('transferShareTitle')}</Text>
            <Text style={styles.transferHelpText}>{t('transferShareHelp')}</Text>
            {transferLoading ? (
              <Text style={styles.transferHelpText}>{t('loading')}</Text>
            ) : (
              <>
                {!!transferQrImage && (
                  <View style={styles.transferQrWrap}>
                    <Image source={{ uri: transferQrImage }} style={styles.transferQrImage} resizeMode="contain" />
                  </View>
                )}
                {!!(transferOwner && (transferOwner.name || transferOwner.email)) && (
                  <View style={styles.ownerInfoBox}>
                    <Text style={styles.ownerInfoLabel}>{t('ownerLabel')}</Text>
                    {!!transferOwner.name && (
                      <Text style={styles.ownerInfoName}>{transferOwner.name}</Text>
                    )}
                    {!!transferOwner.email && (
                      <Text style={styles.ownerInfoEmail}>{transferOwner.email}</Text>
                    )}
                  </View>
                )}
                {!!transferUrl && (
                  <View style={styles.copyRow}>
                    <View style={styles.copyRowTextWrap}>
                      <Text style={styles.copyRowValue} numberOfLines={2}>{transferUrl}</Text>
                    </View>
                    <TouchableOpacity style={styles.copyButton} onPress={() => copyToClipboard(transferUrl)}>
                      <Text style={styles.copyButtonText}>{t('copyLink')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setSendEmailChecked((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={sendEmailChecked ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={colors.accent}
                  />
                  <Text style={styles.checkboxLabel}>{t('shareViaEmail')}</Text>
                </TouchableOpacity>
                {sendEmailChecked && (
                  <TextInput
                    style={styles.input}
                    value={transferEmail}
                    onChangeText={setTransferEmail}
                    placeholder={t('ownerEmailPlaceholder')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                )}
              </>
            )}
            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                style={styles.dialogActionSecondary}
                onPress={cancelTransferRequest}
              >
                <Text style={styles.dialogActionSecondaryText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogActionPrimary, (transferLoading || transferEmailSending) && { opacity: 0.6 }]}
                disabled={transferLoading || transferEmailSending}
                onPress={sendTransferEmail}
              >
                <Text style={styles.dialogActionPrimaryText}>{transferEmailSending ? t('loading') : t('send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showOwnerTransfer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOwnerTransfer(false)}
      >
        <View style={styles.careModalOverlay}>
          <View style={styles.emailDialogCard}>
            {!otConfirmNew ? (
              <>
                <Text style={styles.careModalTitle}>{t('transferProductTitle')}</Text>
                {ownedQuantity != null && (
                  <Text style={styles.transferHelpText}>{`${t('owned')}: ${ownedQuantity}`}</Text>
                )}
                {!!otError && <Text style={styles.otErrorText}>{otError}</Text>}
                <Text style={styles.transferEmailLabel}>{t('quantity')}</Text>
                <TextInput
                  style={styles.input}
                  value={otQuantity}
                  onChangeText={setOtQuantity}
                  keyboardType="number-pad"
                  placeholder="1"
                />
                <Text style={styles.transferEmailLabel}>{t('transferMethodLabel')}</Text>
                <View style={styles.methodChipsWrap}>
                  {OWNER_TRANSFER_METHODS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodChip, otMethod === m && styles.methodChipActive]}
                      onPress={() => setOtMethod(m)}
                    >
                      <Text style={[styles.methodChipText, otMethod === m && styles.methodChipTextActive]}>
                        {t(`method_${m}` as any)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.transferEmailLabel}>{t('receiverEmail')}</Text>
                <TextInput
                  style={styles.input}
                  value={otEmail}
                  onChangeText={setOtEmail}
                  placeholder="recipient@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.dialogActionsRow}>
                  <TouchableOpacity style={styles.dialogActionSecondary} onPress={() => setShowOwnerTransfer(false)}>
                    <Text style={styles.dialogActionSecondaryText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogActionPrimary, otLoading && { opacity: 0.6 }]}
                    disabled={otLoading}
                    onPress={submitOwnerTransfer}
                  >
                    <Text style={styles.dialogActionPrimaryText}>{otLoading ? t('loading') : t('transferButton')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.careModalTitle}>{t('confirmEmailTitle')}</Text>
                <Text style={styles.transferHelpText}>{`${otEmail}`}</Text>
                <Text style={styles.transferHelpText}>{t('inviteSentMsg')}</Text>
                {!!otError && <Text style={styles.otErrorText}>{otError}</Text>}
                <View style={styles.dialogActionsRow}>
                  <TouchableOpacity style={styles.dialogActionSecondary} onPress={() => setOtConfirmNew(false)}>
                    <Text style={styles.dialogActionSecondaryText}>{t('editEmail')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogActionPrimary, otLoading && { opacity: 0.6 }]}
                    disabled={otLoading}
                    onPress={performOwnerTransfer}
                  >
                    <Text style={styles.dialogActionPrimaryText}>{otLoading ? t('loading') : t('sendInvite')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={showCopyInfoDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCopyInfoDialog(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCopyInfoDialog(false)}>
          <View style={styles.copyInfoModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.copyInfoModalCard}>
                <Text style={styles.copyInfoModalText}>Product Info is copied to clipboard</Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={!!selectedCareInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCareInfo(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedCareInfo(null)}>
          <View style={styles.careModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.careModalCard}>
                <Text style={styles.careModalTitle}>{selectedCareInfo?.label}</Text>
                <Text style={styles.careModalDescription}>{selectedCareInfo?.description}</Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={showSalesDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSalesDialog(false)}
      >
        <View style={styles.careModalOverlay}>
          <View style={styles.careModalCard}>
            <Text style={styles.careModalTitle}>Sales Person / Owner Info</Text>
            {[
              { label: 'Name', value: ownerInfo.name },
              { label: 'Email', value: ownerInfo.email },
              { label: 'Phone', value: ownerInfo.phoneNumber },
              { label: 'Address', value: ownerInfo.address },
            ].map((item) => (
              <View key={item.label} style={styles.copyRow}>
                <View style={styles.copyRowTextWrap}>
                  <Text style={styles.copyRowLabel}>{item.label}</Text>
                  <Text style={styles.copyRowValue}>{item.value || '-'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyFieldValue(item.value)}
                  disabled={!item.value}
                >
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.dialogActionButton} onPress={() => setShowSalesDialog(false)}>
              <Text style={styles.dialogActionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showIntroduceDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIntroduceDialog(false)}
      >
        <View style={styles.careModalOverlay}>
          <View style={styles.emailDialogCard}>
            <Text style={styles.careModalTitle}>Introduce this brand to friend</Text>
            <TextInput
              style={styles.input}
              value={friendEmail}
              onChangeText={setFriendEmail}
              placeholder="Friend email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.textArea}
              value={friendContent}
              onChangeText={setFriendContent}
              multiline
            />
            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                style={styles.dialogActionSecondary}
                onPress={() => setShowIntroduceDialog(false)}
              >
                <Text style={styles.dialogActionSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogActionPrimary}
                onPress={async () => {
                  if (!isValidEmail(friendEmail)) {
                    Alert.alert('Error', 'Please enter a valid email address');
                    return;
                  }
                  try {
                    await sendEmailContent(friendEmail, friendContent, 'Brand introduction');
                    setShowIntroduceDialog(false);
                    Alert.alert('Success', 'Email sent');
                  } catch (error: any) {
                    Alert.alert('Error', error?.message || 'Failed to send email');
                  }
                }}
              >
                <Text style={styles.dialogActionPrimaryText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showSendProductDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSendProductDialog(false)}
      >
        <View style={styles.careModalOverlay}>
          <View style={styles.emailDialogCard}>
            <Text style={styles.careModalTitle}>Send product info</Text>
            <TextInput
              style={styles.input}
              value={sendInfoEmail}
              onChangeText={setSendInfoEmail}
              placeholder="Friend email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.textArea}
              value={sendInfoContent}
              onChangeText={setSendInfoContent}
              multiline
            />
            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                style={styles.dialogActionSecondary}
                onPress={() => setShowSendProductDialog(false)}
              >
                <Text style={styles.dialogActionSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogActionPrimary}
                onPress={async () => {
                  if (!isValidEmail(sendInfoEmail)) {
                    Alert.alert('Error', 'Please enter a valid email address');
                    return;
                  }
                  try {
                    await sendEmailContent(sendInfoEmail, sendInfoContent, 'Product information');
                    setShowSendProductDialog(false);
                    Alert.alert('Success', 'Email sent');
                  } catch (error: any) {
                    Alert.alert('Error', error?.message || 'Failed to send email');
                  }
                }}
              >
                <Text style={styles.dialogActionPrimaryText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  topImageSliderContainer: {
    paddingTop: 12,
  },
  productName: {
    fontSize: 20,
    fontWeight: '400',
    color: colors.primary,
    marginBottom: 5,
    textAlign: 'center',
  },
  productModel: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
  },
  pmcBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  sliderTextHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },
  imageCarousel: {
    width: '100%',
  },
  slidePage: {
    paddingHorizontal: 16,
  },
  imageCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(2),
  },
  carouselImageFull: {
    width: '100%',
    height: '100%',
  },
  imageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#c7d2e4',
  },
  imageDotActive: {
    width: 22,
    backgroundColor: colors.accent,
  },
  detailContainer: {
    marginVertical: 15,
    paddingHorizontal: 12,
  },
  detailText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  productDetailMainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 20,
    gap: 10,
  },
  productDetailLeftPane: {
    flex: 2,
    justifyContent: 'center',
  },
  brandCard: {
    flex: 1,
    minHeight: 120,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  brandLogoImage: {
    width: '100%',
    height: 72,
  },
  brandNameText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '400',
    color: colors.primary,
    textAlign: 'center',
  },
  videosContainer: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    marginBottom: 10,
  },
  videoText: {
    marginLeft: 10,
    color: colors.primary,
    fontSize: 14,
  },
  filesContainer: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    marginBottom: 10,
  },
  fileText: {
    marginLeft: 10,
    color: colors.primary,
    fontSize: 14,
  },
  sectionContent: {
    minHeight: 1,
    paddingVertical: 10,
  },
  sectionText: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  sectionTitleBlue: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.primary,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  productIdText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  materialText: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  careSymbolsLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  careSymbolsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  careSymbolBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  careSymbolLabel: {
    fontSize: 10,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  maintenanceDescription: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 15,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  dppInfoBox: {
    marginTop: 15,
    padding: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 20,
  },
  dppTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.primary,
    marginBottom: 4,
  },
  dppText: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 2,
  },
  accordionSection: {
    minHeight: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(1),
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: colors.primary,
  },
  accordionHeaderText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.3,
    flex: 1,
  },
  accordionToggleBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  accordionContent: {
    minHeight: 1,
    backgroundColor: colors.surface,
    paddingBottom: 15,
  },
  securityCheckContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
  securityCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: radius.pill,
    width: '100%',
    maxWidth: 320,
    ...shadow(1),
  },
  securityCheckText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  authenticatedContainer: {
    alignItems: 'center',
    padding: 22,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    ...shadow(1),
  },
  authenticatedIcon: {
    marginBottom: 15,
  },
  authenticatedStatusIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  authenticatedTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  authenticatedText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 5,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    ...shadow(3),
  },
  primaryActionButtonTransfer: {
    backgroundColor: colors.navy,
  },
  primaryActionButtonDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.6,
  },
  primaryActionIcon: {
    width: 26,
    height: 26,
    tintColor: '#fff',
    marginRight: 10,
  },
  primaryActionText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.5,
  },
  primaryActionBadge: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '400',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  likeDislikeContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  likeDislikeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(1),
  },
  likeDislikeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  likeDislikeButtonDisliked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  likeDislikeText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.muted,
    fontWeight: '400',
  },
  likeDislikeTextActive: {
    color: '#fff',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
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
    backgroundColor: colors.primary,
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
    fontWeight: '400',
  },
  disposalLinksContainer: {
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  disposalLinkRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  disposalLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  disposalLink: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  environmentBox: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
  },
  environmentText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
  },
  inquiryLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 15,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  inquiryLink: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
    paddingHorizontal: 20,
  },
  actionIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  marginTop: {
    marginTop: 15,
  },
  joinModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  joinModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    ...shadow(3),
  },
  joinModalText: {
    fontSize: 18,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 18,
    fontWeight: '400',
  },
  joinModalButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
    minWidth: 160,
    alignItems: 'center',
    ...shadow(1),
  },
  joinModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },
  joinModalCancel: {
    color: colors.primary,
    fontSize: 14,
  },
  joinModalSecondary: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  joinModalSecondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '400',
  },
  copyInfoModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  copyInfoModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 22,
    ...shadow(3),
  },
  copyInfoModalText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  careModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  careModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    ...shadow(3),
  },
  careModalTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.primary,
    marginBottom: 8,
  },
  careModalDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  copyRowTextWrap: {
    flex: 1,
  },
  copyRowLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  copyRowValue: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  copyButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
  },
  dialogActionButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  dialogActionButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '400',
  },
  emailDialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    ...shadow(3),
  },
  transferHelpText: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  transferQrWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  transferQrImage: {
    width: 200,
    height: 200,
  },
  transferEmailLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.heading,
    marginBottom: 6,
    marginTop: 4,
  },
  ownerInfoBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  ownerInfoLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  ownerInfoName: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.heading,
  },
  ownerInfoEmail: {
    fontSize: 13,
    color: colors.text,
    marginTop: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.heading,
    marginLeft: 8,
  },
  methodChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6,
    marginBottom: 6,
  },
  methodChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  methodChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '400',
  },
  methodChipTextActive: {
    color: '#fff',
  },
  otErrorText: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    minHeight: 140,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  dialogActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogActionSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dialogActionSecondaryText: {
    color: colors.muted,
    fontSize: 14,
  },
  dialogActionPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  dialogActionPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
  },
});
