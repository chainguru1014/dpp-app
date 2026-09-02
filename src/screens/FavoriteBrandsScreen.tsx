import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import { API_BASE_URL } from '../config/api';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

interface Props {
  navigation: any;
  user?: any;
  onLogout?: () => void;
}

const normalizeRows = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.docs)) return data.docs;
  return [];
};

const logoUri = (raw: string) => {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE_URL}files/${raw.replace(/^\/+/, '')}`;
};

export default function FavoriteBrandsScreen({ navigation, user, onLogout }: Props) {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (!user?._id) {
        setRows([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}engagement/follow/list?user_id=${encodeURIComponent(String(user._id))}`);
        const data = await res.json();
        setRows(res.ok && data?.status === 'success' ? normalizeRows(data?.data) : []);
      } catch (e) {
        console.error('Failed to load favorite brands', e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id]);

  const list = useMemo(() => {
    const mapped = rows.map((raw: any, idx: number) => ({
      id: String(raw?._id ?? idx),
      name: String(raw?.brandName ?? raw?.name ?? 'Brand').trim() || 'Brand',
      detail: String(raw?.brandDetail ?? raw?.detail ?? '').trim(),
      website: String(raw?.brandWebsiteUrl ?? raw?.websiteUrl ?? '').trim(),
      logoRaw: String(raw?.brandLogoUrl ?? raw?.logoUrl ?? '').trim(),
    }));
    const q = search.trim().toLowerCase();
    const filtered = q ? mapped.filter((b) => b.name.toLowerCase().includes(q)) : mapped;
    return filtered.sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [rows, search, sortAsc]);

  const openBrand = (brand: any) =>
    navigation.navigate('BrandDetail', {
      brand: { name: brand.name, detail: brand.detail, website: brand.website, logoUrl: brand.logoRaw },
    });

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()}>
      <View style={styles.screen}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('brandsSearchPlaceholder')}
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAsc((v) => !v)} activeOpacity={0.7}>
            <Icon name="sort-by-alpha" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{t('brandsCount').replace('{count}', String(list.length))}</Text>
          <Text style={styles.metaText}>{sortAsc ? 'A–Z' : 'Z–A'}</Text>
        </View>

        {loading ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('loading')}</Text></View>
        ) : list.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('noFollowedBrands')}</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid}>
            {list.map((brand) => (
              <View key={brand.id} style={styles.card}>
                {brand.logoRaw ? (
                  <Image source={{ uri: logoUri(brand.logoRaw) }} style={styles.cardLogo} resizeMode="contain" />
                ) : (
                  <View style={[styles.cardLogo, styles.cardLogoPlaceholder]}>
                    <Icon name="storefront" size={22} color={colors.placeholder} />
                  </View>
                )}
                <View style={styles.followingPill}>
                  <Text style={styles.followingPillText}>{t('brandsFollowing')}</Text>
                </View>
                <Text style={styles.cardDetail} numberOfLines={2}>{brand.detail || '—'}</Text>
                <TouchableOpacity style={styles.viewBtn} onPress={() => openBrand(brand)} activeOpacity={0.7}>
                  <Text style={styles.viewBtnText}>{t('brandsView')}</Text>
                  <Icon name="arrow-forward" size={14} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: spacing.xxxl },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  cardLogo: { width: 60, height: 24, marginBottom: spacing.sm },
  cardLogoPlaceholder: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  followingPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  followingPillText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  cardDetail: { fontSize: 12, color: colors.muted, lineHeight: 17, minHeight: 34, marginBottom: spacing.sm },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewBtnText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
});
