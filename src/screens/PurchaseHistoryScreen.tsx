import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, ui, shadow } from '../theme';

// On web the flex chain can collapse to 0 height; pin a min height for the list.
const { height: screenH } = Dimensions.get('window');
const LIST_MIN_H = Math.max(320, screenH - 70 - 70 - 100);

interface PurchaseHistoryScreenProps {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

// Buy-request status -> { label, color }.
const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: colors.surfaceAlt, fg: colors.muted },
  confirmed: { label: 'Approved', bg: colors.successSoft, fg: colors.success },
  rejected: { label: 'Rejected', bg: colors.dangerSoft, fg: colors.danger },
  cancelled: { label: 'Cancelled', bg: colors.surfaceAlt, fg: colors.muted },
};

export default function PurchaseHistoryScreen({ navigation, user, onLogout }: PurchaseHistoryScreenProps) {
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
        const res = await fetch(`${API_BASE_URL}transfer/purchases?user_id=${encodeURIComponent(String(user._id))}`);
        const data = await res.json();
        if (res.ok && data?.status === 'success' && Array.isArray(data?.data)) {
          setItems(data.data);
        } else {
          setItems([]);
        }
      } catch (error) {
        console.error('Failed to load purchase history', error);
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
    const meta = STATUS_META[item.status] || STATUS_META.pending;
    const when = item.time ? new Date(item.time).toLocaleString() : '';
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate('Result',
            item.token_id != null
              ? { productId: String(item.product_id), qrcodeId: String(item.token_id), returnTo: 'PurchaseHistory' }
              : {
                  productData: { _id: item.product_id, name: item.name, model: item.model, images: item.image ? [item.image] : [] },
                  productId: item.product_id,
                  returnTo: 'PurchaseHistory',
                }
          )
        }
      >
        {item.image ? (
          <Image source={{ uri: getFileUrl(item.image) }} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={[styles.thumb, styles.emptyImage]} />
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name || 'Product'}</Text>
          {!!item.model && <Text style={styles.model} numberOfLines={1}>{item.model}</Text>}
          <Text style={styles.time}>{when}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton={true}>
      <View style={styles.container}>
        <Text style={[ui.screenTitle, styles.title]}>Purchase History</Text>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No purchase history yet</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, idx) => `${item._id || idx}`}
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
  model: { fontSize: 12, color: colors.muted, marginTop: 1 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '400' },
});
