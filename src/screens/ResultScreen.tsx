import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { CareSymbol, getCareSymbolLabel } from '../components/CareSymbols';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';

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

export default function ResultScreen({ route, navigation, user, onLogout }: ResultScreenProps) {
  const BRAND_COLOR = '#3c5b92';
  const { t } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const [productData, setProductData] = useState<any>(route?.params?.productData || {});
  const [expandedSections, setExpandedSections] = useState<{ [key: number]: boolean }>({});
  const [showSecurityCheck, setShowSecurityCheck] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<'like' | 'dislike' | 'buy' | null>(null);
  const scannerRef = useRef<any>(null);

  const sections = [
    { id: 0, title: t('resultSectionProductDetails') },
    { id: 1, title: t('resultSectionCareLabel') },
    { id: 2, title: t('resultSectionMaterials') },
    { id: 3, title: t('resultSectionDispose') },
    { id: 4, title: t('resultSectionTraceabilityEsg') },
  ];

  const isAuthenticatedUser = !!user;
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
        const raw = await AsyncStorage.getItem('scannedProductFeedback');
        const feedbackMap = raw ? JSON.parse(raw) : {};
        setSelectedFeedback(feedbackMap[key] || null);
      } catch (error) {
        console.error('Error loading product feedback:', error);
      }
    };
    loadFeedback();
  }, [productData?._id, productData?.token_id, productData?.scannedQRCode]);

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

  const handleLike = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    setSelectedFeedback((prev) => {
      const next = prev === 'like' ? null : 'like';
      updateProductFeedback(next);
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
      return next;
    });
  };

  const handleBuy = () => {
    if (!isAuthenticatedUser) {
      showLoginPrompt();
      return;
    }
    setSelectedFeedback((prev) => {
      const next = prev === 'buy' ? null : 'buy';
      updateProductFeedback(next);
      return next;
    });
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

  const renderProductDetails = () => {
    const videos = normalizeToArray(productData?.videos);
    const files = normalizeToStringArray(productData?.files);
    const detail = String(productData?.detail ?? '').trim();

    return (
      <View style={styles.sectionContent}>
        {detail && (
          <View style={styles.detailContainer}>
            <Text style={styles.detailText}>{detail}</Text>
          </View>
        )}

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
            {iconIds.map((id: string, index: number) => (
              <View key={index} style={styles.careSymbolBox}>
                <CareSymbol iconId={id} selected={true} />
                <Text style={styles.careSymbolLabel}>
                  {getCareSymbolLabel(id)}
                </Text>
              </View>
            ))}
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
      <View style={styles.topImageSliderContainer}>
        <View style={styles.sliderTextHeader}>
          <Text style={styles.productName}>{productData?.name || '—'}</Text>
          <Text style={styles.productModel}>{productData?.model || '—'}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imageCarousel}
          contentContainerStyle={styles.imageCarouselContent}
        >
          {images.map((img: string, index: number) => (
            <Image
              key={`${img}-${index}`}
              source={{ uri: getFileUrl(img) }}
              style={styles.carouselImage}
              resizeMode="contain"
            />
          ))}
        </ScrollView>
      </View>
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

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={isAuthenticatedUser}
      onBackPress={isAuthenticatedUser ? () => navigation.navigate('Home') : undefined}
      hideBottomBar={false}
      onGuestAction={showLoginPrompt}
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
              style={styles.securityCheckButton}
              onPress={handleSecurityCheck}
            >
              <Image source={require('../assets/shield.png')} style={styles.actionIcon} />
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

        {/* Like/Dislike/Buy Buttons */}
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
          <TouchableOpacity
            style={[styles.likeDislikeButton, selectedFeedback === 'buy' && styles.likeDislikeButtonActive]}
            onPress={handleBuy}
          >
            <Image source={require('../assets/cart.png')} style={styles.actionIcon} />
            <Text style={[styles.likeDislikeText, selectedFeedback === 'buy' && styles.likeDislikeTextActive]}>Buy</Text>
          </TouchableOpacity>
        </View>

        {/* Accordion Sections */}
        {sections.map((section) => (
          <View key={section.id} style={styles.accordionSection}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection(section.id)}
            >
              <Text style={styles.accordionHeaderText}>{section.title}</Text>
              <Icon
                name={expandedSections[section.id] ? 'remove' : 'add'}
                size={24}
                color={BRAND_COLOR}
              />
            </TouchableOpacity>
            {expandedSections[section.id] && (
              <View style={styles.accordionContent}>
                {section.id === 0 ? renderProductDetails() : renderSectionContent(section.id)}
              </View>
            )}
          </View>
        ))}

        <View style={styles.storeBadgesContainer}>
          <Image
            source={require('../assets/App_Store_(iOS)-Badge-Alternative-Logo.wine.png')}
            style={styles.storeBadge}
            resizeMode="contain"
          />
          <Image
            source={require('../assets/Google_Play-Badge-Logo.wine.png')}
            style={styles.storeBadge}
            resizeMode="contain"
          />
        </View>
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
            <Text style={styles.joinModalText}>Please join to our app!</Text>
            <TouchableOpacity
              style={styles.joinModalButton}
              onPress={() => {
                setShowJoinDialog(false);
                navigation.navigate('Login', {
                  redirectTo: 'Result',
                  redirectParams: {
                    productData,
                    productId: route?.params?.productId,
                    qrcodeId: route?.params?.qrcodeId,
                  },
                });
              }}
            >
              <Text style={styles.joinModalButtonText}>Sign up!</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowJoinDialog(false)}>
              <Text style={styles.joinModalCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '600',
    color: '#3c5b92',
    marginBottom: 5,
    textAlign: 'center',
  },
  productModel: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  sliderTextHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },
  imageCarousel: {
    marginBottom: 12,
  },
  imageCarouselContent: {
    paddingRight: 8,
    paddingLeft: 20,
  },
  carouselImage: {
    width: width - 40,
    height: Math.min((width - 40) * 1.2, 420),
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  detailContainer: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  videosContainer: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  videoText: {
    marginLeft: 10,
    color: '#3c5b92',
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
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  fileText: {
    marginLeft: 10,
    color: '#3c5b92',
    fontSize: 14,
  },
  sectionContent: {
    minHeight: 1,
    paddingVertical: 10,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  sectionTitleBlue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3c5b92',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  productIdText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  materialText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  careSymbolsLabel: {
    fontSize: 12,
    color: '#666',
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
    color: '#3c5b92',
    textAlign: 'center',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 12,
    color: '#666',
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
    color: '#333',
    marginBottom: 15,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  dppInfoBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginHorizontal: 20,
  },
  dppTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3c5b92',
    marginBottom: 4,
  },
  dppText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  accordionSection: {
    minHeight: 1,
    marginBottom: 1,
    backgroundColor: '#fff',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#3c5b92',
  },
  accordionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  accordionContent: {
    minHeight: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#3c5b92',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
  },
  securityCheckText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  authenticatedContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    width: '100%',
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  authenticatedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
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
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  likeDislikeButtonActive: {
    backgroundColor: '#3c5b92',
    borderColor: '#3c5b92',
  },
  likeDislikeButtonDisliked: {
    backgroundColor: '#3c5b92',
    borderColor: '#3c5b92',
  },
  likeDislikeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
    backgroundColor: '#3c5b92',
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
    color: '#666',
  },
  disposalLink: {
    fontSize: 13,
    color: '#3c5b92',
    textDecorationLine: 'underline',
  },
  environmentBox: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
  },
  environmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  inquiryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 15,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  inquiryLink: {
    fontSize: 13,
    color: '#3c5b92',
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
  storeBadgesContainer: {
    marginTop: 20,
    marginBottom: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  storeBadge: {
    width: Math.min(width * 0.48, 220),
    height: 80,
  },
  joinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  joinModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  joinModalText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  joinModalButton: {
    backgroundColor: '#3c5b92',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  joinModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  joinModalCancel: {
    color: '#3c5b92',
    fontSize: 14,
  },
});
