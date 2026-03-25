import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface ScannedProduct {
  _id: string;
  name: string;
  model?: string;
  token_id?: number;
  images?: string[];
  scannedAt: number;
  scannedQRCode?: string;
  feedback?: 'like' | 'dislike' | 'buy' | null;
}

interface ScannedProductListScreenProps {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

export default function ScannedProductListScreen({
  navigation,
  user,
  onLogout,
}: ScannedProductListScreenProps) {
  const { t } = useI18n();
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScannedProducts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadScannedProducts();
    }, [])
  );

  const getDedupeKey = (product: ScannedProduct) => {
    if (product.scannedQRCode) return `qr:${product.scannedQRCode}`;
    if (product._id && product.token_id != null) return `token:${product._id}-${product.token_id}`;
    if (product._id) return `product:${product._id}`;
    return `fallback:${product.name || ''}-${product.model || ''}`;
  };

  const getFeedbackKey = (product: ScannedProduct) => {
    if (product.scannedQRCode) return `qr:${product.scannedQRCode}`;
    if (product._id && product.token_id != null) return `token:${product._id}-${product.token_id}`;
    if (product._id) return `product:${product._id}`;
    return '';
  };

  const loadScannedProducts = async () => {
    try {
      const query = user?._id ? `?user_id=${encodeURIComponent(String(user._id))}` : '';
      const response = await fetch(`${API_BASE_URL}qrcode/scan/list${query}`);
      if (response.ok) {
        const result = await response.json();
        if (result?.status === 'success' && Array.isArray(result?.data)) {
          const backendProducts = result.data as ScannedProduct[];
          const feedbackRaw = await AsyncStorage.getItem('scannedProductFeedback');
          const feedbackMap = feedbackRaw ? JSON.parse(feedbackRaw) : {};
          const mergedProducts = backendProducts.map((product) => ({
            ...product,
            feedback: feedbackMap[getFeedbackKey(product)] || null,
          }));
          setScannedProducts(mergedProducts);
          await AsyncStorage.setItem('scannedProducts', JSON.stringify(mergedProducts));
          return;
        }
      }

      // Fallback to local cache if backend list API is not available.
      const stored = await AsyncStorage.getItem('scannedProducts');
      if (stored) {
        const products = JSON.parse(stored);
        const dedupedMap = new Map<string, ScannedProduct>();
        products.forEach((product: ScannedProduct) => {
          const dedupeKey = getDedupeKey(product);
          const prev = dedupedMap.get(dedupeKey);
          if (!prev || product.scannedAt > prev.scannedAt) {
            dedupedMap.set(dedupeKey, product);
          }
        });
        const uniqueProducts = Array.from(dedupedMap.values());
        // Sort by most recently scanned
        const feedbackRaw = await AsyncStorage.getItem('scannedProductFeedback');
        const feedbackMap = feedbackRaw ? JSON.parse(feedbackRaw) : {};
        const sorted = uniqueProducts.sort(
          (a: ScannedProduct, b: ScannedProduct) => b.scannedAt - a.scannedAt
        );
        const mergedProducts = sorted.map((product) => ({
          ...product,
          feedback: feedbackMap[getFeedbackKey(product)] || null,
        }));
        setScannedProducts(mergedProducts);

        // Persist cleaned-up list so duplicates don't reappear later.
        await AsyncStorage.setItem('scannedProducts', JSON.stringify(mergedProducts));
      } else {
        setScannedProducts([]);
      }
    } catch (error) {
      console.error('Error loading scanned products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileUrl = (filename: string) => {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    if (filename.startsWith('/files/')) {
      return `${API_BASE_URL}${filename.substring(1)}`;
    }
    const cleanFilename = filename.startsWith('/') ? filename.substring(1) : filename;
    return `${API_BASE_URL}files/${cleanFilename}`;
  };

  const handleProductPress = (product: ScannedProduct) => {
    // Navigate to result screen with product data
    navigation.navigate('Result', { productData: product });
  };

  const renderProductItem = ({ item }: { item: ScannedProduct }) => {
    const images = Array.isArray(item.images) ? item.images : [];
    const firstImage = images.length > 0 ? images[0] : null;
    return (
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        {firstImage ? (
          <Image
            source={{ uri: getFileUrl(firstImage) }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>{t('noImage')}</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name || t('unnamedProduct')}
          </Text>
          {item.model && (
            <Text style={styles.productModel} numberOfLines={1}>
              {item.model}
            </Text>
          )}
          <Text style={styles.itemIdText} numberOfLines={1}>
            Item ID: {item.token_id != null ? item.token_id : '—'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    iconSource: any,
    items: ScannedProduct[]
  ) => {
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Image source={iconSource} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {items.length === 0 ? (
          <Text style={styles.noItemsText}>No items</Text>
        ) : (
          <FlatList
            data={items}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.scannedQRCode || `${item._id}-${item.scannedAt}`}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.sectionListContent}
          />
        )}
      </View>
    );
  };

  const onlyScannedItems = scannedProducts.filter((p) => !p.feedback);
  const dislikedItems = scannedProducts.filter((p) => p.feedback === 'dislike');
  const likedItems = scannedProducts.filter((p) => p.feedback === 'like');
  const boughtItems = scannedProducts.filter((p) => p.feedback === 'buy');

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={true}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('scannedProductsTitle')}</Text>
        </View>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : scannedProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('noScannedProductsYet')}</Text>
            <Text style={styles.emptySubtext}>
              {t('scanQrToAddProducts')}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {renderSection('Only Scanned', require('../assets/qr-code.png'), onlyScannedItems)}
            {renderSection('Disliked', require('../assets/dislike.png'), dislikedItems)}
            {renderSection('Liked', require('../assets/like.png'), likedItems)}
            {renderSection('Bought', require('../assets/cart.png'), boughtItems)}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  listContent: {
    padding: 10,
    paddingBottom: 24,
  },
  list: {
    flex: 1,
    minHeight:500,
  },
  productItem: {
    width: (width - 40) / 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 5,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  sectionIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
    tintColor: '#2f3f5a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2f3f5a',
  },
  sectionListContent: {
    paddingBottom: 4,
  },
  noItemsText: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1 / 1.3,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#999',
  },
  productInfo: {
    marginTop: 8,
    minHeight: 34,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  productModel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  itemIdText: {
    marginTop: 4,
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
