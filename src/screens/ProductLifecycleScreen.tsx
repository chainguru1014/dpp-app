import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import { CareSymbol, getCareSymbolLabel } from '../components/CareSymbols';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, radius, spacing, shadow } from '../theme';

interface Props {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

type TabKey = 'details' | 'care' | 'materials' | 'dispose' | 'traceability';

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'details', labelKey: 'lifecycleTabDetails' },
  { key: 'care', labelKey: 'lifecycleTabCare' },
  { key: 'materials', labelKey: 'lifecycleTabMaterials' },
  { key: 'dispose', labelKey: 'lifecycleTabDispose' },
  { key: 'traceability', labelKey: 'lifecycleTabTraceability' },
];

const JOURNEY_STAGES: { key: string; icon: string; labelKey: string; descKey: string }[] = [
  { key: 'materials', icon: 'spa', labelKey: 'lifecycleStageMaterials', descKey: 'lifecycleJourneyMaterialsDesc' },
  { key: 'manufacturing', icon: 'precision-manufacturing', labelKey: 'lifecycleStageManufacturing', descKey: 'lifecycleJourneyManufacturingDesc' },
  { key: 'transportation', icon: 'local-shipping', labelKey: 'lifecycleStageTransportation', descKey: 'lifecycleJourneyTransportationDesc' },
  { key: 'use', icon: 'checkroom', labelKey: 'lifecycleStageUse', descKey: 'lifecycleJourneyUseDesc' },
  { key: 'endOfLife', icon: 'recycling', labelKey: 'lifecycleStageEndOfLife', descKey: 'lifecycleJourneyEndOfLifeDesc' },
];

const toArray = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : typeof v === 'object' ? Object.values(v) : [v]);
const toStrArray = (v: any): string[] =>
  toArray(v).flatMap((x) => (typeof x === 'string' ? [x.trim()].filter(Boolean) : typeof x === 'object' ? toStrArray(x) : []));

const fileUrl = (filename: string) => {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE_URL}files/${String(filename).replace(/^\/+/, '')}`;
};

function Bar({ label, percent }: { label: string; percent: number }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, percent))}%` }]} />
      </View>
      <Text style={styles.barValue}>{percent}%</Text>
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

export default function ProductLifecycleScreen({ navigation, route, user, onLogout }: Props) {
  const { t } = useI18n();
  const [productData, setProductData] = useState<any>(route?.params?.productData || {});
  const [tab, setTab] = useState<TabKey>('details');
  const [journeyExpanded, setJourneyExpanded] = useState(false);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [isInAlbum, setIsInAlbum] = useState(false);

  const productId = route?.params?.productId ?? productData?._id;
  const qrcodeId = route?.params?.qrcodeId ?? productData?.token_id;

  useEffect(() => {
    if (productData?._id || productId == null || qrcodeId == null) return;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}qrcode/public/${encodeURIComponent(String(productId))}/${encodeURIComponent(String(qrcodeId))}`
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.status === 'success') setProductData(data.data || {});
      } catch (e) {
        console.error('Lifecycle: failed to load product', e);
      }
    })();
  }, [productId, qrcodeId, productData?._id]);

  useEffect(() => {
    const brandUrl = String(productData?.brandInfo?.websiteUrl || '').trim();
    if (!user?._id || !productData?._id) return;
    fetch(
      `${API_BASE_URL}engagement/album/status?user_id=${encodeURIComponent(String(user._id))}&product_id=${encodeURIComponent(String(productData._id))}&token_id=${encodeURIComponent(String(productData?.token_id ?? ''))}`
    )
      .then((r) => r.json())
      .then((j) => setIsInAlbum(!!j?.added))
      .catch(() => {});
    void brandUrl;
  }, [user?._id, productData?._id, productData?.token_id]);

  const toggleFavorite = async () => {
    if (!user?._id || !productData?._id) return;
    const method = isInAlbum ? 'DELETE' : 'POST';
    setIsInAlbum((v) => !v);
    try {
      await fetch(`${API_BASE_URL}engagement/album`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user._id,
          product_id: productData._id,
          token_id: productData?.token_id ?? null,
          productSnapshot: {
            name: productData?.name || '',
            model: productData?.model || '',
            images: toStrArray(productData?.images),
            brandInfo: productData?.brandInfo || {},
          },
        }),
      });
    } catch (e) {
      setIsInAlbum((v) => !v);
    }
  };

  const facts = productData?.detailFacts || {};
  const maintenance = productData?.maintenance || {};
  const careIcons = toStrArray(maintenance.iconIds);
  const careTips = toStrArray(maintenance.tips);
  const materialSize = productData?.materialSize || {};
  const materials = toArray(materialSize.materials);
  const certifications = toStrArray(productData?.certifications);
  const esg = productData?.traceabilityEsg || {};
  const materialOrigins = toArray(esg.materialOrigins);
  const disposal = productData?.disposal || {};
  const impact = productData?.sustainabilityImpact || {};
  const routeInfo = esg.route || {};

  const disposeLinks = useMemo(
    () =>
      [
        { key: 'reuse', labelKey: 'lifecycleReuse', url: disposal.reuseUrl },
        { key: 'repair', labelKey: 'lifecycleRepair', url: disposal.repairUrl },
        { key: 'rental', labelKey: 'lifecycleRentResell', url: disposal.rentalUrl },
        { key: 'dispose', labelKey: 'lifecycleDisposeResponsibly', url: disposal.disposeUrl },
      ].filter((l) => !!l.url),
    [disposal.reuseUrl, disposal.repairUrl, disposal.rentalUrl, disposal.disposeUrl]
  );

  const openUrl = (url: string) => {
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    Linking.openURL(safe).catch(() => {});
  };

  const renderDetails = () => (
    <View>
      {!!String(productData?.detail || '').trim() && (
        <Text style={styles.paragraph}>{String(productData.detail).trim()}</Text>
      )}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleProductFacts')}</Text>
        <KV label={t('summaryBrand')} value={productData?.brandInfo?.name || ''} />
        <KV label={t('model')} value={productData?.model || ''} />
        <KV label={t('summaryMaterial')} value={facts.material || ''} />
        <KV label={t('lifecycleFit')} value={facts.fit || ''} />
        <KV label={t('lifecycleWash')} value={facts.wash || ''} />
        <KV label={t('lifecycleDurability')} value={facts.durability || ''} />
        <KV label={t('madeIn')} value={esg.originCountry || esg.madeIn || ''} />
      </View>
    </View>
  );

  const renderCare = () => (
    <View>
      {careIcons.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleCareSymbols')}</Text>
          <View style={styles.careRow}>
            {careIcons.map((id, i) => (
              <View key={`${id}-${i}`} style={styles.careItem}>
                <CareSymbol iconId={id} selected />
                <Text style={styles.careLabel} numberOfLines={2}>{getCareSymbolLabel(id)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {(careTips.length > 0 || !!maintenance.description) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleCareTips')}</Text>
          {careTips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Icon name="check-circle" size={16} color={colors.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
          {!!maintenance.description && <Text style={styles.paragraph}>{maintenance.description}</Text>}
        </View>
      )}
      {careIcons.length === 0 && careTips.length === 0 && !maintenance.description && (
        <Text style={styles.emptyText}>{t('lifecycleNoData')}</Text>
      )}
    </View>
  );

  const renderMaterials = () => (
    <View>
      {materials.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleComposition')}</Text>
          {materials.map((m: any, i: number) => (
            <Bar key={i} label={m.material || '—'} percent={Number(m.percent) || 0} />
          ))}
        </View>
      )}
      {materialOrigins.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleMaterialOrigins')}</Text>
          {materialOrigins.map((o: any, i: number) => (
            <KV key={i} label={o.material || '—'} value={[o.country || o.origin, o.companyName].filter(Boolean).join(' · ')} />
          ))}
        </View>
      )}
      {certifications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleCertifications')}</Text>
          <View style={styles.chipWrap}>
            {certifications.map((c, i) => (
              <View key={i} style={styles.chip}>
                <Icon name="verified" size={13} color={colors.primary} />
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {materials.length === 0 && materialOrigins.length === 0 && certifications.length === 0 && (
        <Text style={styles.emptyText}>{t('lifecycleNoData')}</Text>
      )}
    </View>
  );

  const renderDispose = () => (
    <View>
      {disposeLinks.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleExtendLife')}</Text>
          {disposeLinks.map((l) => (
            <TouchableOpacity key={l.key} style={styles.linkRow} onPress={() => openUrl(l.url)} activeOpacity={0.7}>
              <Text style={styles.linkText}>{t(l.labelKey as any)}</Text>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {(impact.co2Avoided || impact.waterSaved || impact.energySaved) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleSustainabilityImpact')}</Text>
          <View style={styles.tileRow}>
            {impact.co2Avoided ? (
              <View style={styles.tile}>
                <Text style={styles.tileValue}>{impact.co2Avoided}</Text>
                <Text style={styles.tileLabel}>{t('lifecycleCo2Avoided')}</Text>
              </View>
            ) : null}
            {impact.waterSaved ? (
              <View style={styles.tile}>
                <Text style={styles.tileValue}>{impact.waterSaved}</Text>
                <Text style={styles.tileLabel}>{t('lifecycleWaterSaved')}</Text>
              </View>
            ) : null}
            {impact.energySaved ? (
              <View style={styles.tile}>
                <Text style={styles.tileValue}>{impact.energySaved}</Text>
                <Text style={styles.tileLabel}>{t('lifecycleEnergySaved')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
      {disposeLinks.length === 0 && !impact.co2Avoided && !impact.waterSaved && !impact.energySaved && (
        <Text style={styles.emptyText}>{t('lifecycleNoData')}</Text>
      )}
    </View>
  );

  const renderTraceability = () => (
    <View>
      <View style={styles.card}>
        <KV label={t('lifecycleCountryOfOrigin')} value={esg.originCountry || esg.madeIn || ''} />
        <KV label={t('lifecycleMaterialOrigins')} value={materialOrigins.length ? String(materialOrigins.length) : ''} />
        <KV label={t('lifecycleShippingRoute')} value={[routeInfo.origin, routeInfo.destination].filter(Boolean).join(' → ')} />
        <KV label={t('lifecycleTransportMode')} value={routeInfo.mode || ''} />
        <KV label={t('distance')} value={esg.distance || ''} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleEnvImpact')}</Text>
        <KV label={t('co2Production')} value={esg.co2Production || ''} />
        <KV label={t('co2Transportation')} value={routeInfo.emissions || esg.co2Transportation || ''} />
      </View>
    </View>
  );

  const renderTab = () => {
    switch (tab) {
      case 'details': return renderDetails();
      case 'care': return renderCare();
      case 'materials': return renderMaterials();
      case 'dispose': return renderDispose();
      case 'traceability': return renderTraceability();
      default: return null;
    }
  };

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.goBack()}
      bottomBar={user && user.actorKind !== 'Employee' ? 'product' : 'auto'}
      rightIcon={user ? 'heart' : 'notification'}
      isFavorite={isInAlbum}
      onToggleFavorite={toggleFavorite}
      product={productData}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {/* Lifecycle Journey card */}
        <View style={styles.card}>
          <View style={styles.journeyHeader}>
            <Text style={styles.cardTitle}>{t('lifecycleJourney')}</Text>
            <TouchableOpacity onPress={() => setJourneyExpanded((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name={journeyExpanded ? 'unfold-less' : 'unfold-more'} size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {!journeyExpanded ? (
            <View style={styles.journeyStrip}>
              {JOURNEY_STAGES.map((s, i) => (
                <React.Fragment key={s.key}>
                  <View style={styles.journeyStage}>
                    <View style={styles.journeyDot}>
                      <Icon name={s.icon} size={15} color={colors.primary} />
                    </View>
                    <Text style={styles.journeyStageLabel} numberOfLines={1}>{t(s.labelKey as any)}</Text>
                  </View>
                  {i < JOURNEY_STAGES.length - 1 && <View style={styles.journeyConnector} />}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View>
              {JOURNEY_STAGES.map((s) => {
                const open = openStage === s.key;
                return (
                  <View key={s.key} style={styles.journeyAccItem}>
                    <TouchableOpacity
                      style={styles.journeyAccHeader}
                      onPress={() => setOpenStage(open ? null : s.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.journeyDot}>
                        <Icon name={s.icon} size={15} color={colors.primary} />
                      </View>
                      <Text style={styles.journeyAccTitle}>{t(s.labelKey as any)}</Text>
                      <Icon name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color={colors.muted} />
                    </TouchableOpacity>
                    {open && (
                      <View style={styles.journeyAccBody}>
                        <Text style={styles.paragraph}>{t(s.descKey as any)}</Text>
                        {s.key === 'transportation' && (
                          <>
                            <KV label={t('lifecycleShippingRoute')} value={[routeInfo.origin, routeInfo.destination].filter(Boolean).join(' → ')} />
                            <KV label={t('lifecycleTransportMode')} value={routeInfo.mode || ''} />
                            <KV label={t('distance')} value={esg.distance || ''} />
                            <KV label={t('co2Transportation')} value={routeInfo.emissions || esg.co2Transportation || ''} />
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Persistent tab row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabRowContent}>
          {TABS.map((tb) => (
            <TouchableOpacity
              key={tb.key}
              style={[styles.tabBtn, tab === tb.key && styles.tabBtnActive]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{t(tb.labelKey as any)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tabContent}>{renderTab()}</View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow(1),
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  paragraph: { fontSize: 13, color: colors.text, lineHeight: 19, marginBottom: spacing.sm },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  journeyStrip: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  journeyStage: { alignItems: 'center', width: 56 },
  journeyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  journeyStageLabel: { fontSize: 9, color: colors.muted, textAlign: 'center' },
  journeyConnector: { flex: 1, height: 1, backgroundColor: colors.border, marginTop: 16 },
  journeyAccItem: { borderTopWidth: 1, borderTopColor: colors.border },
  journeyAccHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  journeyAccTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  journeyAccBody: { paddingBottom: spacing.md, paddingLeft: 40 },
  tabRow: { marginBottom: spacing.md },
  tabRowContent: { gap: spacing.sm, paddingRight: spacing.lg },
  tabBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
  tabContent: {},
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  kvLabel: { fontSize: 12, color: colors.muted },
  kvValue: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'right' },
  careRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  careItem: { width: 64, alignItems: 'center' },
  careLabel: { fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4 },
  tipText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  barLabel: { width: 90, fontSize: 12, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  barValue: { width: 40, fontSize: 12, color: colors.muted, textAlign: 'right' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, color: colors.text },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  tileRow: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  tileValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 2 },
});
