import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { firstImageOf, listAlbum } from '../utils/consumerApi';
import { colors, radius, spacing, shadow } from '../theme';

const COLUMNS = 3;

// Products the user tapped Like on — 3 cards per row (first photo + name).
// A card opens that product's summary page.
export default function ProductAlbumScreen({ navigation, user, onLogout }: any) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    try {
      setItems(await listAlbum(String(user._id)));
    } catch (e) {
      console.error('Album load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (item: any) => {
    const snap = item?.productSnapshot || {};
    navigation.navigate('ProductSummary', {
      product: { ...snap, _id: String(item.product_id), token_id: item.token_id },
      productId: String(item.product_id),
      qrcodeId: item.token_id != null ? String(item.token_id) : undefined,
    });
  };

  const renderItem = ({ item }: any) => {
    const snap = item?.productSnapshot || {};
    const img = firstImageOf(snap);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => open(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={snap.name || t('titleProductSummary')}
      >
        <View style={styles.thumb}>
          {img ? (
            <Image source={{ uri: img }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcon name="tshirt-crew-outline" size={40} color={colors.placeholder} />
          )}
        </View>
        <Text style={styles.cardName} numberOfLines={2}>{snap.name || '—'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} title={t('titleProductAlbum')}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it._id)}
          renderItem={renderItem}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.rowWrap}
          contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcon name="heart-outline" size={84} color={colors.borderStrong} />
              <Text style={styles.emptyText}>{t('albumEmpty')}</Text>
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
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  rowWrap: { gap: spacing.md },
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
  cardName: { fontSize: 15, fontWeight: '600', color: colors.heading, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, minHeight: 52 },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xxl, gap: spacing.lg },
  emptyText: { fontSize: 19, color: colors.muted, textAlign: 'center', lineHeight: 26 },
});
