import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Linking, Platform } from 'react-native';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, ui, shadow } from '../theme';

interface FavoriteBrandsScreenProps {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

function normalizeFollowRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.docs)) return data.docs;
  return [];
}

export default function FavoriteBrandsScreen({ navigation, user, onLogout }: FavoriteBrandsScreenProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const list = useMemo(
    () =>
      rows.map((raw: any, idx: number) => {
        const website = String(raw?.brandWebsiteUrl ?? raw?.websiteUrl ?? raw?.website ?? '').trim();
        const name = String(raw?.brandName ?? raw?.name ?? 'Brand').trim() || 'Brand';
        const detail = String(raw?.brandDetail ?? raw?.detail ?? '').trim();
        const logoRaw = String(raw?.brandLogoUrl ?? raw?.logoUrl ?? '').trim();
        const id = String(raw?._id ?? `${website}-${idx}`);
        return { id, name, detail, website, logoRaw, raw };
      }),
    [rows]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (!user?._id) {
        setRows([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}engagement/follow/list?user_id=${encodeURIComponent(String(user._id))}`
        );
        const data = await res.json();
        if (res.ok && data?.status === 'success') {
          setRows(normalizeFollowRows(data?.data));
        } else {
          setRows([]);
        }
      } catch (error) {
        console.error('Failed to load favorite brands', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id]);

  const openWebsite = (website: string) => {
    const w = String(website || '').trim();
    if (!w) return;
    const safe = /^https?:\/\//i.test(w) ? w : `https://${w}`;
    if (Platform.OS === 'web') {
      (globalThis as any)?.open?.(safe, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(safe);
  };

  const logoUri = (logoRaw: string) => {
    if (!logoRaw) return '';
    if (logoRaw.startsWith('http://') || logoRaw.startsWith('https://')) return logoRaw;
    return `${API_BASE_URL}files/${logoRaw.replace(/^\/+/, '')}`;
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton={true}>
      <View style={styles.container}>
        <Text style={[ui.screenTitle, styles.title]}>{t('favoriteBrands')}</Text>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('noFollowedBrands')}</Text>
          </View>
        ) : (
          <View style={styles.tableWrap}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.nameCol]}>{t('brandNameColumn')}</Text>
              <Text style={[styles.headerCell, styles.detailCol]}>{t('brandDetailColumn')}</Text>
              <Text style={[styles.headerCell, styles.imageCol]}>{t('brandImageColumn')}</Text>
            </View>
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.8}
                  onPress={() => openWebsite(item.website)}
                  disabled={!item.website}
                >
                  <View style={styles.nameCol}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.rowDetail} numberOfLines={4}>
                      {item.detail || '—'}
                    </Text>
                  </View>
                  <View style={styles.imageCol}>
                    {item.logoRaw ? (
                      <Image source={{ uri: logoUri(item.logoRaw) }} style={styles.rowImage} />
                    ) : (
                      <Image source={require('../assets/logo.jpg')} style={styles.rowImage} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { marginBottom: spacing.lg },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  tableWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow(1),
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  list: { paddingBottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 88,
  },
  nameCol: { flex: 1, paddingHorizontal: spacing.sm },
  detailCol: { flex: 1.4, paddingHorizontal: spacing.xs + 2 },
  imageCol: { flex: 0.85, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  rowName: { fontSize: 13, color: colors.text, fontWeight: '600' },
  rowDetail: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  rowImage: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
});
