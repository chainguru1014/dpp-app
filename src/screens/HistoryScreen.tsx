import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, ui, shadow } from '../theme';

// On web the flex chain can collapse to 0 height; pin a min height for the list.
const { height: screenH } = Dimensions.get('window');
const LIST_MIN_H = Math.max(320, screenH - 70 - 70 - 100);

interface HistoryScreenProps {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

// Activity type -> { labelKey (resolved via t() at render), color }.
const TYPE_META: Record<string, { labelKey: any; bg: string; fg: string }> = {
  scan: { labelKey: 'scannedLabel', bg: '#e7edf6', fg: colors.primary },
  visit: { labelKey: 'visited', bg: '#e7edf6', fg: colors.primary },
  like: { labelKey: 'liked', bg: colors.successSoft, fg: colors.success },
  dislike: { labelKey: 'disliked', bg: colors.dangerSoft, fg: colors.danger },
  buy: { labelKey: 'buy', bg: '#e3f0ff', fg: colors.accent },
  transfer: { labelKey: 'transferred', bg: '#e6e9f5', fg: colors.navy },
  receive: { labelKey: 'received', bg: '#e3f0ff', fg: colors.accent },
};

export default function HistoryScreen({ navigation, user, onLogout }: HistoryScreenProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user?._id) {
        setLoading(false);
        setItems([]);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}transfer/activity?user_id=${encodeURIComponent(String(user._id))}`);
        const data = await res.json();
        if (res.ok && data?.status === 'success' && Array.isArray(data?.data)) {
          setItems(data.data);
        } else {
          setItems([]);
        }
      } catch (error) {
        console.error('Failed to load history', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id]);

  const getFileUrl = (filename: string) => {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
    return `${API_BASE_URL}files/${filename.replace(/^\/+/, '')}`;
  };

  const renderItem = ({ item }: { item: any }) => {
    const meta = TYPE_META[item.type];
    const typeLabel = meta ? t(meta.labelKey) : item.type;
    const typeBg = meta ? meta.bg : colors.surfaceAlt;
    const typeFg = meta ? meta.fg : colors.muted;
    const when = item.time ? new Date(item.time).toLocaleString() : '';
    const isTransfer = item.type === 'transfer' || item.type === 'receive';
    const sub = isTransfer
      ? [item.quantity ? `Qty ${item.quantity}` : '', item.status].filter(Boolean).join(' · ')
      : '';
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() =>
          item.product_id &&
          navigation.navigate('Result',
            item.token != null
              ? { productId: String(item.product_id), qrcodeId: String(item.token), returnTo: 'History' }
              : {
                  productData: { _id: item.product_id, name: item.productName, images: item.productImage ? [item.productImage] : [] },
                  productId: item.product_id,
                  returnTo: 'History',
                }
          )
        }
      >
        {item.productImage ? (
          <Image source={{ uri: getFileUrl(item.productImage) }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={[styles.thumb, styles.emptyImage]} />
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.productName || t('homeProduct')}</Text>
          {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
          <Text style={styles.time}>{when}</Text>
        </View>
        <View style={[styles.typePill, { backgroundColor: typeBg }]}>
          <Text style={[styles.typeText, { color: typeFg }]}>{typeLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton={true}>
      <View style={styles.container}>
        <Text style={[ui.screenTitle, styles.title]}>{t('productHistory')}</Text>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('noHistoryYet')}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, idx) => `${item.type}-${item.product_id || ''}-${idx}`}
            style={styles.flatList}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
          />
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { marginBottom: spacing.lg },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  flatList: { flex: 1, minHeight: LIST_MIN_H },
  list: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  thumb: { width: 52, height: 64, borderRadius: radius.sm, backgroundColor: '#fff' },
  emptyImage: { backgroundColor: colors.surfaceAlt },
  info: { flex: 1, paddingHorizontal: spacing.md },
  name: { fontSize: 14, color: colors.heading, fontWeight: '400' },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4 },
  typePill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  typeText: { fontSize: 11, fontWeight: '400' },
});
