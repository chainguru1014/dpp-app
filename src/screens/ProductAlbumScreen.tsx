import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { firstImageOf, formatPrice, listAlbum, listCart, setInCart, setReaction } from '../utils/consumerApi';
import { colors, radius, spacing, shadow } from '../theme';

const COLUMNS = 3;
const DAY = 24 * 60 * 60 * 1000;
type DateFilter = 'all' | 'today' | 'week' | 'month';

const itemKey = (productId: any, tokenId: any) => `${productId}:${tokenId ?? ''}`;

// Products the user tapped Like on, newest save first — 3 cards per row with
// photo, name, brand, price and Add to Cart / Remove buttons. A search box
// (product or brand name) plus saved-date chips filter the grid.
// A card opens that product's summary page.
export default function ProductAlbumScreen({ navigation, user, onLogout }: any) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [cartKeys, setCartKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    try {
      const [album, cart] = await Promise.all([listAlbum(String(user._id)), listCart().catch(() => [])]);
      setItems(album);
      setCartKeys(new Set(cart.map((c: any) => itemKey(c.product_id, c.token_id))));
    } catch (e) {
      console.error('Album load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live product data when the backend sent it, else the saved snapshot.
  const view = (item: any) => {
    const snap = item?.productSnapshot || {};
    const live = item?.product || {};
    return {
      name: live.name || snap.name || '',
      brand: live.brandInfo?.name || snap.brandInfo?.name || '',
      image: firstImageOf(live.images ? live : snap),
      price: formatPrice(live.price, live.currency),
      savedAt: new Date(item.createdAt || item.updatedAt || 0).getTime(),
    };
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const minTime = dateFilter === 'today' ? startOfToday.getTime()
      : dateFilter === 'week' ? now - 7 * DAY
      : dateFilter === 'month' ? now - 30 * DAY
      : 0;
    return items
      .filter((it) => {
        const v = view(it);
        if (q && !v.name.toLowerCase().includes(q) && !v.brand.toLowerCase().includes(q)) return false;
        if (minTime && v.savedAt < minTime) return false;
        return true;
      })
      .sort((a, b) => view(b).savedAt - view(a).savedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, dateFilter]);

  const asProduct = (item: any) => ({ ...(item.product || item.productSnapshot || {}), _id: String(item.product_id), token_id: item.token_id });

  const open = (item: any) => {
    navigation.navigate('ProductSummary', {
      product: asProduct(item),
      productId: String(item.product_id),
      qrcodeId: item.token_id != null ? String(item.token_id) : undefined,
    });
  };

  const toggleCart = async (item: any) => {
    const key = itemKey(item.product_id, item.token_id);
    if (busyKey) return;
    const next = !cartKeys.has(key);
    setBusyKey(key);
    setCartKeys((prev) => { const s = new Set(prev); if (next) s.add(key); else s.delete(key); return s; });
    try {
      await setInCart(asProduct(item), next);
    } catch (e) {
      setCartKeys((prev) => { const s = new Set(prev); if (next) s.delete(key); else s.add(key); return s; });
    } finally {
      setBusyKey(null);
    }
  };

  // Remove = clear the Like (which also removes it from the album).
  const remove = async (item: any) => {
    if (busyKey) return;
    setBusyKey(itemKey(item.product_id, item.token_id));
    setItems((prev) => prev.filter((x) => x._id !== item._id));
    try {
      await setReaction(String(user._id), asProduct(item), null);
    } catch (e) {
      load();
    } finally {
      setBusyKey(null);
    }
  };

  const renderItem = ({ item }: any) => {
    const v = view(item);
    const key = itemKey(item.product_id, item.token_id);
    const inCart = cartKeys.has(key);
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => open(item)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={v.name}>
          <View style={styles.thumb}>
            {v.image ? (
              <Image source={{ uri: v.image }} style={styles.thumbImg} resizeMode="cover" />
            ) : (
              <MaterialCommunityIcon name="tshirt-crew-outline" size={40} color={colors.placeholder} />
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={2}>{v.name || '—'}</Text>
            {!!v.brand && <Text style={styles.cardBrand} numberOfLines={1}>{v.brand}</Text>}
            <Text style={[styles.cardPrice, !v.price && styles.cardPriceMuted]} numberOfLines={1}>{v.price || t('priceOnRequest')}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.cardBtn, inCart && styles.cardBtnActive]}
            onPress={() => toggleCart(item)}
            disabled={busyKey === key}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={inCart ? t('cartRemove') : t('actAddToCart')}
            accessibilityState={{ selected: inCart }}
          >
            <MaterialCommunityIcon name={inCart ? 'cart-check' : 'cart-plus'} size={26} color={inCart ? colors.white : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardBtn}
            onPress={() => remove(item)}
            disabled={busyKey === key}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('albumRemove')}
          >
            <MaterialCommunityIcon name="trash-can-outline" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  const filters = items.length > 0 && (
    <View style={styles.filters}>
      <View style={styles.searchWrap}>
        <MaterialCommunityIcon name="magnify" size={28} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('albumSearchPlaceholder')}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel={t('close')}>
            <MaterialCommunityIcon name="close-circle" size={24} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <MaterialCommunityIcon name="calendar-month-outline" size={26} color={colors.primary} style={styles.chipIcon} />
        <Chip label={t('albumFilterAll')} active={dateFilter === 'all'} onPress={() => setDateFilter('all')} />
        <Chip label={t('albumFilterToday')} active={dateFilter === 'today'} onPress={() => setDateFilter('today')} />
        <Chip label={t('albumFilter7Days')} active={dateFilter === 'week'} onPress={() => setDateFilter('week')} />
        <Chip label={t('albumFilter30Days')} active={dateFilter === 'month'} onPress={() => setDateFilter('month')} />
      </ScrollView>
    </View>
  );

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} title={t('titleProductAlbum')}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(it) => String(it._id)}
          renderItem={renderItem}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.rowWrap}
          ListHeaderComponent={filters || null}
          contentContainerStyle={[styles.list, shown.length === 0 && styles.listEmpty]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcon name={items.length ? 'filter-remove-outline' : 'thumb-up-outline'} size={84} color={colors.borderStrong} />
              <Text style={styles.emptyText}>{items.length ? t('albumNoMatch') : t('albumEmpty')}</Text>
            </View>
          }
        />
      )}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  list: { padding: spacing.md, gap: spacing.md },
  listEmpty: { flexGrow: 1 },
  rowWrap: { gap: spacing.sm },
  filters: { gap: spacing.sm, marginBottom: spacing.xs },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  searchInput: { flex: 1, fontSize: 20, color: colors.text, paddingVertical: 10 },
  clearBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chipRow: { alignItems: 'center', gap: spacing.sm, paddingRight: spacing.md },
  chipIcon: { marginRight: 2 },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 18, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.white },
  // flex:1 + maxWidth keeps a short last row from stretching its cards.
  card: {
    flex: 1,
    maxWidth: `${100 / COLUMNS}%` as any,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow(1),
  },
  thumb: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  cardBody: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, gap: 1 },
  cardName: { fontSize: 17, fontWeight: '700', color: colors.heading, minHeight: 44 },
  cardBrand: { fontSize: 16, color: colors.muted },
  cardPrice: { fontSize: 18, fontWeight: '800', color: colors.primary },
  cardPriceMuted: { fontSize: 15, fontWeight: '500', color: colors.muted },
  cardActions: { flexDirection: 'row', gap: 6, padding: spacing.sm },
  cardBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl, gap: spacing.lg },
  emptyText: { fontSize: 21, color: colors.muted, textAlign: 'center', lineHeight: 26 },
});
