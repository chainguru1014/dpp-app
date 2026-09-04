import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

const fileUrl = (filename: string) => {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE_URL}files/${String(filename).replace(/^\/+/, '')}`;
};

const firstImage = (p: any) => {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  return imgs.length ? fileUrl(imgs[0]) : '';
};

export function ProductRow({ product, caption, onPress }: { product: any; caption: string; onPress: () => void }) {
  const img = firstImage(product);
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      {img ? (
        <Image source={{ uri: img }} style={styles.rowImage} resizeMode="cover" />
      ) : (
        <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
          <Icon name="inventory-2" size={22} color={colors.placeholder} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{product?.name || '—'}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{product?.brandInfo?.name || product?.model || ''}</Text>
        <Text style={styles.rowCaption} numberOfLines={1}>{caption}</Text>
      </View>
      <Icon name="chevron-right" size={24} color={colors.muted} />
    </TouchableOpacity>
  );
}

export function SectionCard({
  title,
  onViewAll,
  emptyText,
  children,
  hasItems,
  style,
}: {
  title: string;
  onViewAll?: () => void;
  emptyText: string;
  children: React.ReactNode;
  hasItems: boolean;
  style?: any;
}) {
  const { t } = useI18n();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAll}>{t('viewAll')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {hasItems ? children : <Text style={styles.emptyText}>{emptyText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    ...shadow(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  viewAll: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.muted, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, gap: spacing.md },
  rowImage: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  rowImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.heading },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowCaption: { fontSize: 12, color: colors.placeholder, marginTop: 3 },
});
