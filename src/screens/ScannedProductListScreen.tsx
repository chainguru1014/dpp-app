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
import { colors, spacing, radius, ui, shadow } from '../theme';

const { width, height: screenHeight } = Dimensions.get('window');
// Top bar (70) + bottom bar (70) from AppLayout, plus this screen's header (~58).
const WEB_LIST_HEIGHT = Math.max(320, screenHeight - 70 - 70 - 58);
// The content area is split into two fixed-height, independently scrolling panels.
const PANEL_HEIGHT = Math.max(180, Math.floor((WEB_LIST_HEIGHT - 16) / 2));

interface ScannedProduct {
  _id: string;
  name: string;
  model?: string;
  token_id?: number;
  images?: string[];
  scannedAt: number;
  scannedQRCode?: string;
  feedback?: 'like' | 'dislike' | 'buy' | null;
  /** From backend scan list: how this product was added for this user */
  visitSource?: 'scan' | 'visit';
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
  const [albumItems, setAlbumItems] = useState<ScannedProduct[]>([]);
  const [ownedProducts, setOwnedProducts] = useState<any[]>([]);
  const [soldProducts, setSoldProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topTab, setTopTab] = useState<'myproducts' | 'album' | 'sold'>('myproducts');
  const [bottomTab, setBottomTab] = useState<'scanned' | 'liked' | 'disliked'>('scanned');

  useEffect(() => {
    loadScannedProducts();
  }, [user?._id]);

  useFocusEffect(
    React.useCallback(() => {
      loadScannedProducts();
    }, [user?._id])
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
      // Products the user currently owns (per-unit holdings ledger).
      if (user?._id) {
        try {
          const ownedRes = await fetch(`${API_BASE_URL}transfer/my-products?user_id=${encodeURIComponent(String(user._id))}`);
          const ownedData = await ownedRes.json();
          if (ownedRes.ok && ownedData?.status === 'success' && Array.isArray(ownedData?.data)) {
            setOwnedProducts(ownedData.data.map((p: any) => ({ ...p, ownedQuantity: p.heldQuantity })));
          } else {
            setOwnedProducts([]);
          }
        } catch (ownedError) {
          console.error('Error loading owned products:', ownedError);
          setOwnedProducts([]);
        }

        // Products the user previously owned and has sold/transferred away.
        try {
          const soldRes = await fetch(`${API_BASE_URL}transfer/sold?user_id=${encodeURIComponent(String(user._id))}`);
          const soldData = await soldRes.json();
          if (soldRes.ok && soldData?.status === 'success' && Array.isArray(soldData?.data)) {
            setSoldProducts(soldData.data);
          } else {
            setSoldProducts([]);
          }
        } catch (soldError) {
          console.error('Error loading sold products:', soldError);
          setSoldProducts([]);
        }
      } else {
        setOwnedProducts([]);
        setSoldProducts([]);
      }

      if (user?._id) {
        try {
          const albumRes = await fetch(`${API_BASE_URL}engagement/album/list?user_id=${encodeURIComponent(String(user._id))}`);
          const albumData = await albumRes.json();
          if (albumRes.ok && albumData?.status === 'success' && Array.isArray(albumData?.data)) {
            const mappedAlbum = albumData.data.map((item: any) => ({
              _id: String(item.product_id || ''),
              token_id: item.token_id,
              scannedAt: new Date(item.updatedAt || item.createdAt || Date.now()).getTime(),
              ...(item.productSnapshot || {}),
            }));
            setAlbumItems(mappedAlbum);
          } else {
            setAlbumItems([]);
          }
        } catch (albumError) {
          console.error('Error loading album items:', albumError);
          setAlbumItems([]);
        }
      } else {
        setAlbumItems([]);
      }

      const query = user?._id ? `?user_id=${encodeURIComponent(String(user._id))}` : '';
      const response = await fetch(`${API_BASE_URL}qrcode/scan/list${query}`);
      if (response.ok) {
        const result = await response.json();
        if (result?.status === 'success' && Array.isArray(result?.data)) {
          const backendProducts = result.data as ScannedProduct[];
          const feedbackRaw = await AsyncStorage.getItem('scannedProductFeedback');
          const feedbackMap = feedbackRaw ? JSON.parse(feedbackRaw) : {};
          let serverReactions: Record<string, string> = {};
          if (user?._id) {
            try {
              const reactRes = await fetch(
                `${API_BASE_URL}engagement/product-reactions?user_id=${encodeURIComponent(String(user._id))}`
              );
              const reactJson = await reactRes.json().catch(() => ({}));
              if (reactRes.ok && reactJson?.status === 'success' && Array.isArray(reactJson?.data)) {
                serverReactions = {};
                reactJson.data.forEach((row: any) => {
                  const pid = row?.product_id != null ? String(row.product_id) : '';
                  const tid = row?.token_id != null ? String(row.token_id) : '';
                  if (pid && tid && row?.reaction) {
                    serverReactions[`${pid}:${tid}`] = row.reaction;
                  }
                });
              }
            } catch (e) {
              console.warn('product-reactions fetch failed', e);
            }
          }
          const mergedProducts = backendProducts.map((product) => {
            const pid = product?._id != null ? String(product._id) : '';
            const tid = product?.token_id != null ? String(product.token_id) : '';
            const fromServer = pid && tid ? serverReactions[`${pid}:${tid}`] : undefined;
            const fb =
              fromServer === 'like' || fromServer === 'dislike' || fromServer === 'buy'
                ? fromServer
                : feedbackMap[getFeedbackKey(product)] || null;
            const vs: 'scan' | 'visit' = (product as any).visitSource === 'visit' ? 'visit' : 'scan';
            return {
              ...product,
              feedback: fb,
              visitSource: vs,
            };
          });
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
        const feedbackRaw = await AsyncStorage.getItem('scannedProductFeedback');
        const feedbackMap = feedbackRaw ? JSON.parse(feedbackRaw) : {};
        let serverReactionsLocal: Record<string, string> = {};
        if (user?._id) {
          try {
            const reactRes = await fetch(
              `${API_BASE_URL}engagement/product-reactions?user_id=${encodeURIComponent(String(user._id))}`
            );
            const reactJson = await reactRes.json().catch(() => ({}));
            if (reactRes.ok && reactJson?.status === 'success' && Array.isArray(reactJson?.data)) {
              reactJson.data.forEach((row: any) => {
                const pid = row?.product_id != null ? String(row.product_id) : '';
                const tid = row?.token_id != null ? String(row.token_id) : '';
                if (pid && tid && row?.reaction) {
                  serverReactionsLocal[`${pid}:${tid}`] = row.reaction;
                }
              });
            }
          } catch (e) {
            console.warn('product-reactions fetch failed', e);
          }
        }
        const sorted = uniqueProducts.sort(
          (a: ScannedProduct, b: ScannedProduct) => b.scannedAt - a.scannedAt
        );
        const mergedProducts = sorted.map((product) => {
          const pid = product?._id != null ? String(product._id) : '';
          const tid = product?.token_id != null ? String(product.token_id) : '';
          const fromServer = pid && tid ? serverReactionsLocal[`${pid}:${tid}`] : undefined;
          const fb =
            fromServer === 'like' || fromServer === 'dislike' || fromServer === 'buy'
              ? fromServer
              : feedbackMap[getFeedbackKey(product)] || null;
          const vs: 'scan' | 'visit' = (product as any).visitSource === 'visit' ? 'visit' : 'scan';
          return { ...product, feedback: fb, visitSource: vs };
        });
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
    navigation.navigate('Result', {
      productData: product,
      productId: product._id,
      qrcodeId: product.token_id != null ? String(product.token_id) : undefined,
    });
  };

  // Owned products open the detail page in "owner" mode (Buy -> Transfer button).
  const handleOwnedPress = (product: any) => {
    navigation.navigate('Result', {
      productData: product,
      productId: product._id,
      qrcodeId: product.token_id != null ? String(product.token_id) : undefined,
      owned: true,
      ownedQuantity: product.ownedQuantity,
    });
  };

  const renderOwnedItem = ({ item }: { item: any }) => {
    const images = Array.isArray(item.images) ? item.images : [];
    const firstImage = images.length > 0 ? images[0] : null;
    const isOwned = item.ownedQuantity != null; // ledger holding vs Bought reaction
    return (
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => (isOwned ? handleOwnedPress(item) : handleProductPress(item))}
        activeOpacity={0.7}
      >
        {firstImage ? (
          <Image source={{ uri: getFileUrl(firstImage) }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>{t('noImage')}</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <View style={[styles.sourceChip, isOwned ? styles.ownedChip : styles.boughtChip]}>
            <Text
              style={[styles.sourceChipText, isOwned ? styles.ownedChipText : styles.boughtChipText]}
              numberOfLines={1}
            >
              {isOwned ? t('owned') : t('bought')}
            </Text>
          </View>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name || t('unnamedProduct')}
          </Text>
          {item.model && (
            <Text style={styles.productModel} numberOfLines={1}>
              {item.model}
            </Text>
          )}
          {isOwned && (
            <Text style={styles.itemIdText} numberOfLines={1}>
              {t('quantity')}: {item.ownedQuantity ?? '—'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOwnedSection = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBadge}>
          <Image source={require('../assets/cart.png')} style={styles.sectionIcon} />
        </View>
        <Text style={styles.sectionTitle}>{t('myProductsOwned')}</Text>
      </View>
      {myProductsList.length === 0 ? (
        <Text style={styles.noItemsText}>{t('noOwnedProducts')}</Text>
      ) : (
        <FlatList
          data={myProductsList}
          renderItem={renderOwnedItem}
          keyExtractor={(item) =>
            item.ownedQuantity != null
              ? `owned-${item._id}`
              : `bought-${item.scannedQRCode || `${item._id}-${item.scannedAt}`}`
          }
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.sectionListContent}
        />
      )}
    </View>
  );

  // A product the user sold/transferred away (read-only detail, no Transfer).
  const renderSoldItem = ({ item }: { item: any }) => {
    const images = Array.isArray(item.images) ? item.images : [];
    const firstImage = images.length > 0 ? images[0] : null;
    return (
      <TouchableOpacity style={styles.productItem} onPress={() => handleProductPress(item)} activeOpacity={0.7}>
        {firstImage ? (
          <Image source={{ uri: getFileUrl(firstImage) }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>{t('noImage')}</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <View style={[styles.sourceChip, styles.soldChip]}>
            <Text style={[styles.sourceChipText, styles.soldChipText]} numberOfLines={1}>
              {t('sellSection')}
            </Text>
          </View>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name || t('unnamedProduct')}
          </Text>
          {item.model && (
            <Text style={styles.productModel} numberOfLines={1}>
              {item.model}
            </Text>
          )}
          <Text style={styles.itemIdText} numberOfLines={1}>
            {t('quantity')}: {item.quantity ?? '—'}
          </Text>
          {!!item.to_owner?.email && (
            <Text style={styles.itemIdText} numberOfLines={1}>
              {item.to_owner.email}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSoldSection = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBadge}>
          <Image source={require('../assets/send.png')} style={styles.sectionIcon} />
        </View>
        <Text style={styles.sectionTitle}>{t('sellSection')}</Text>
      </View>
      {soldProducts.length === 0 ? (
        <Text style={styles.noItemsText}>{t('noSoldProducts')}</Text>
      ) : (
        <FlatList
          data={soldProducts}
          renderItem={renderSoldItem}
          keyExtractor={(item) => `sold-${item.transfer_id}`}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.sectionListContent}
        />
      )}
    </View>
  );

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
          <View style={styles.sourceChip}>
            <Text style={styles.sourceChipText} numberOfLines={1}>
              {item.visitSource === 'visit' ? 'Visited' : 'QR scan'}
            </Text>
          </View>
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
          {item.feedback ? (
            <View
              style={[
                styles.statusPill,
                item.feedback === 'dislike' ? styles.statusPillDislike : styles.statusPillPositive,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  item.feedback === 'dislike' ? styles.statusPillTextDislike : styles.statusPillTextPositive,
                ]}
                numberOfLines={1}
              >
                {item.feedback === 'like' ? 'Liked' : item.feedback === 'dislike' ? 'Disliked' : 'Bought'}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusPill, styles.statusPillNeutral]}>
              <Text style={[styles.statusPillText, styles.statusPillTextNeutral]} numberOfLines={1}>
                No rating
              </Text>
            </View>
          )}
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
          <View style={styles.sectionIconBadge}>
            <Image source={iconSource} style={styles.sectionIcon} />
          </View>
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

  // A single tab button inside a panel's tab bar.
  const renderTab = (
    key: string,
    label: string,
    icon: any,
    active: string,
    setActive: (k: any) => void
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.tabBtn, active === key && styles.tabBtnActive]}
      onPress={() => setActive(key)}
      activeOpacity={0.7}
    >
      <Image
        source={icon}
        style={[styles.tabIcon, { opacity: active === key ? 1 : 0.5 }]}
        resizeMode="contain"
      />
      <Text style={[styles.tabText, active === key && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // A 3-column grid of items, or an empty hint.
  const renderGrid = (items: any[], renderItem: any, keyPrefix: string, emptyText: string) =>
    !items || items.length === 0 ? (
      <Text style={styles.noItemsText}>{emptyText}</Text>
    ) : (
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(it, idx) => `${keyPrefix}-${it._id || it.transfer_id || it.scannedQRCode || idx}-${idx}`}
        numColumns={3}
        scrollEnabled={false}
        contentContainerStyle={styles.sectionListContent}
      />
    );

  const onlyScannedItems = scannedProducts.filter((p) => !p.feedback);
  const dislikedItems = scannedProducts.filter((p) => p.feedback === 'dislike');
  const likedItems = scannedProducts.filter((p) => p.feedback === 'like');

  // "My Products" = products owned in the holdings ledger + products the user
  // marked as Bought (deduped). Owned items keep the Transfer flow.
  const ownedIds = new Set(ownedProducts.map((p) => String(p._id)));
  const boughtItems = scannedProducts.filter(
    (p) => p.feedback === 'buy' && !ownedIds.has(String(p._id))
  );
  const myProductsList = [...ownedProducts, ...boughtItems];

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={true}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[ui.screenTitle, styles.headerTitle]}>{t('myProductsTitle')}</Text>
        </View>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : (
          <View style={styles.splitWrap}>
            {/* Top panel: My Products / My Album / Sold */}
            <View style={[styles.panel, { height: PANEL_HEIGHT }]}>
              <View style={styles.tabRow}>
                {renderTab('myproducts', t('myProductsOwned'), require('../assets/cart.png'), topTab, setTopTab)}
                {renderTab('album', 'My Album', require('../assets/add-image.png'), topTab, setTopTab)}
                {renderTab('sold', t('sellSection'), require('../assets/send.png'), topTab, setTopTab)}
              </View>
              <ScrollView style={styles.panelBody} contentContainerStyle={styles.panelBodyContent}>
                {topTab === 'myproducts' && renderGrid(myProductsList, renderOwnedItem, 'mp', t('noOwnedProducts'))}
                {topTab === 'album' && renderGrid(albumItems, renderProductItem, 'al', 'No items')}
                {topTab === 'sold' && renderGrid(soldProducts, renderSoldItem, 'sd', t('noSoldProducts'))}
              </ScrollView>
            </View>

            {/* Bottom panel: Only Scanned / Liked / Disliked */}
            <View style={[styles.panel, { height: PANEL_HEIGHT }]}>
              <View style={styles.tabRow}>
                {renderTab('scanned', 'Only Scanned', require('../assets/qr-code.png'), bottomTab, setBottomTab)}
                {renderTab('liked', 'Liked', require('../assets/like.png'), bottomTab, setBottomTab)}
                {renderTab('disliked', 'Disliked', require('../assets/dislike.png'), bottomTab, setBottomTab)}
              </View>
              <ScrollView style={styles.panelBody} contentContainerStyle={styles.panelBodyContent}>
                {bottomTab === 'scanned' && renderGrid(onlyScannedItems, renderProductItem, 'os', 'No items')}
                {bottomTab === 'liked' && renderGrid(likedItems, renderProductItem, 'lk', 'No items')}
                {bottomTab === 'disliked' && renderGrid(dislikedItems, renderProductItem, 'dl', 'No items')}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    // base typography from ui.screenTitle
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  list: {
    flex: 1,
    minHeight: WEB_LIST_HEIGHT,
  },
  splitWrap: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow(1),
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.navy,
  },
  tabIcon: {
    width: 18,
    height: 18,
    marginRight: 5,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.navy,
  },
  panelBody: {
    flex: 1,
  },
  panelBodyContent: {
    padding: spacing.sm,
    paddingBottom: spacing.lg,
  },
  productItem: {
    width: (width - 70) / 3,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    margin: 5,
    padding: spacing.sm,
    ...shadow(1),
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs + 2,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionIcon: {
    width: 16,
    height: 16,
    tintColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionListContent: {
    paddingBottom: spacing.xs,
  },
  noItemsText: {
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1 / 1.3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: colors.placeholder,
  },
  productInfo: {
    marginTop: spacing.sm,
    minHeight: 34,
    alignItems: 'center',
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.heading,
    textAlign: 'center',
  },
  productModel: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  itemIdText: {
    marginTop: spacing.xs,
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
  },
  sourceChip: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  sourceChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  ownedChip: {
    backgroundColor: colors.accent,
  },
  ownedChipText: {
    color: '#fff',
  },
  soldChip: {
    backgroundColor: colors.navy,
  },
  soldChipText: {
    color: '#fff',
  },
  boughtChip: {
    backgroundColor: colors.successSoft,
  },
  boughtChipText: {
    color: colors.success,
  },
  statusPill: {
    marginTop: spacing.xs,
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillPositive: {
    backgroundColor: colors.successSoft,
  },
  statusPillDislike: {
    backgroundColor: colors.dangerSoft,
  },
  statusPillNeutral: {
    backgroundColor: colors.surfaceAlt,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusPillTextPositive: {
    color: colors.success,
  },
  statusPillTextDislike: {
    color: colors.danger,
  },
  statusPillTextNeutral: {
    color: colors.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
});
