import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { firstImageOf, formatPrice, listCart, setInCart } from '../utils/consumerApi';
import { colors, radius, spacing, shadow, MIN_TOUCH } from '../theme';

// Products added with Add to Cart — one row each (photo, name, brand, price)
// with a big Buy button that opens that product's Purchase page.
export default function CartScreen({ navigation, user, onLogout }: any) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listCart());
    } catch (e) {
      console.error('Cart load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = async (item: any) => {
    setItems((prev) => prev.filter((x) => x._id !== item._id));
    try {
      await setInCart({ _id: item.product_id, token_id: item.token_id }, false);
    } catch (e) {
      load();
    }
  };

  // Only shown when every priced item shares one currency.
  const total = useMemo(() => {
    const priced = items.filter((i) => i.product?.price != null);
    if (!priced.length) return '';
    const cur = priced[0].product.currency || 'EUR';
    if (priced.some((i) => (i.product.currency || 'EUR') !== cur)) return '';
    return formatPrice(priced.reduce((sum, i) => sum + Number(i.product.price) * (i.quantity || 1), 0), cur);
  }, [items]);

  const renderItem = ({ item }: any) => {
    const p = item.product || {};
    const img = firstImageOf(p);
    const price = formatPrice(p.price, p.currency);
    const productForPage = { ...p, token_id: item.token_id ?? p.token_id };
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.thumb}
          onPress={() => navigation.navigate('ProductSummary', {
            product: productForPage,
            productId: String(p._id),
            qrcodeId: item.token_id != null ? String(item.token_id) : undefined,
          })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={p.name}
        >
          {img ? <Image source={{ uri: img }} style={styles.thumbImg} resizeMode="cover" /> : (
            <MaterialCommunityIcon name="tshirt-crew-outline" size={36} color={colors.placeholder} />
          )}
        </TouchableOpacity>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{p.name || '—'}</Text>
          {!!p.brandInfo?.name && <Text style={styles.brand} numberOfLines={1}>{p.brandInfo.name}</Text>}
          <Text style={[styles.price, !price && styles.priceMuted]}>{price || t('priceOnRequest')}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.buyBtn}
            onPress={() => navigation.navigate('Purchase', { product: productForPage })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${t('cartBuy')} ${p.name || ''}`}
          >
            <MaterialCommunityIcon name="shopping" size={32} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => remove(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('cartRemove')}
          >
            <MaterialCommunityIcon name="trash-can-outline" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton title={t('titleCart')}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it._id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcon name="cart-outline" size={84} color={colors.borderStrong} />
              <Text style={styles.emptyText}>{t('cartEmpty')}</Text>
            </View>
          }
          ListFooterComponent={total ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('cartTotal')}</Text>
              <Text style={styles.totalValue}>{total}</Text>
            </View>
          ) : null}
        />
      )}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  list: { padding: spacing.lg, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow(1),
  },
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: '700', color: colors.heading },
  brand: { fontSize: 16, color: colors.muted, marginTop: 2 },
  price: { fontSize: 21, fontWeight: '700', color: colors.primary, marginTop: spacing.xs },
  priceMuted: { fontSize: 16, fontWeight: '500', color: colors.muted },
  actions: { alignItems: 'center', gap: spacing.xs },
  buyBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  removeBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
  },
  totalLabel: { fontSize: 20, color: colors.text, fontWeight: '600' },
  totalValue: { fontSize: 24, color: colors.primary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xxl, gap: spacing.lg },
  emptyText: { fontSize: 19, color: colors.muted, textAlign: 'center' },
});
