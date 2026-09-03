import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
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

type TabKey = 'journey' | 'details' | 'care' | 'materials' | 'dispose' | 'traceability';

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'journey', labelKey: 'lifecycleTabJourney' },
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

function KV({ label, value, icon }: { label: string; value: string; icon?: string }) {
  if (!value) return null;
  return (
    <View style={styles.kvRow}>
      <View style={styles.kvLabelWrap}>
        {!!icon && <Icon name={icon} size={14} color={colors.muted} style={{ marginRight: 6 }} />}
        <Text style={styles.kvLabel}>{label}</Text>
      </View>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.infoBox}>
      <Icon name="info-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

export default function ProductLifecycleScreen({ navigation, route, user, onLogout }: Props) {
  const { t } = useI18n();
  const [productData, setProductData] = useState<any>(route?.params?.productData || {});
  const [tab, setTab] = useState<TabKey>('journey');
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
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
    if (!user?._id || !productData?._id) return;
    fetch(
      `${API_BASE_URL}engagement/album/status?user_id=${encodeURIComponent(String(user._id))}&product_id=${encodeURIComponent(String(productData._id))}&token_id=${encodeURIComponent(String(productData?.token_id ?? ''))}`
    )
      .then((r) => r.json())
      .then((j) => setIsInAlbum(!!j?.added))
      .catch(() => {});
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
  const originCountry = esg.originCountry || esg.madeIn || '';
  const originCountries = Array.from(
    new Set(materialOrigins.map((o: any) => o.country || o.origin).filter(Boolean))
  ) as string[];

  const disposeLinks = useMemo(
    () => [
      { key: 'reuse', icon: 'autorenew', labelKey: 'lifecycleReuse', subKey: 'lifecycleReuseSub', url: disposal.reuseUrl },
      { key: 'repair', icon: 'build', labelKey: 'lifecycleRepair', subKey: 'lifecycleRepairSub', url: disposal.repairUrl },
      { key: 'rental', icon: 'storefront', labelKey: 'lifecycleRentResell', subKey: 'lifecycleRentResellSub', url: disposal.rentalUrl },
      { key: 'dispose', icon: 'delete-outline', labelKey: 'lifecycleDisposeResponsibly', subKey: 'lifecycleDisposeResponsiblySub', url: disposal.disposeUrl },
    ],
    [disposal.reuseUrl, disposal.repairUrl, disposal.rentalUrl, disposal.disposeUrl]
  );

  const openUrl = (url?: string) => {
    if (!url) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    Linking.openURL(safe).catch(() => {});
  };

  // ---- tab bodies ----

  const renderJourney = () => (
    <View>
      {JOURNEY_STAGES.map((s, i) => {
        const open = openStage === s.key;
        return (
          <View key={s.key} style={styles.journeyItem}>
            <View style={styles.journeyLineCol}>
              <View style={styles.journeyDot}>
                <Icon name={s.icon} size={15} color="#fff" />
              </View>
              {i < JOURNEY_STAGES.length - 1 && <View style={styles.journeyLine} />}
            </View>
            <TouchableOpacity
              style={styles.journeyBody}
              activeOpacity={0.7}
              onPress={() => setOpenStage(open ? null : s.key)}
            >
              <View style={styles.journeyHeadRow}>
                <Text style={styles.journeyTitle}>{t(s.labelKey as any)}</Text>
                <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={colors.muted} />
              </View>
              <Text style={styles.journeyDesc}>{t(s.descKey as any)}</Text>
              {open && s.key === 'transportation' && (
                <View style={styles.journeyDetail}>
                  <KV label={t('lifecycleShippingDistance')} value={esg.distance || ''} />
                  <KV label={t('lifecycleRoute')} value={[routeInfo.origin, routeInfo.destination].filter(Boolean).join(' → ')} />
                  <KV label={t('lifecycleTransportMode')} value={routeInfo.mode || ''} />
                  <KV label={t('lifecycleEstEmissions')} value={routeInfo.emissions || esg.co2Transportation || ''} />
                </View>
              )}
              {open && s.key === 'materials' && !!originCountries.length && (
                <View style={styles.journeyDetail}>
                  <KV label={t('lifecycleMaterialOrigins')} value={originCountries.join(', ')} />
                </View>
              )}
              {open && s.key === 'endOfLife' && disposeLinks.some((l) => l.url) && (
                <View style={styles.journeyDetail}>
                  {disposeLinks.filter((l) => l.url).map((l) => (
                    <TouchableOpacity key={l.key} onPress={() => openUrl(l.url)}>
                      <Text style={styles.journeyLink}>{t(l.labelKey as any)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
      <InfoBox>{t('lifecycleJourneyHint')}</InfoBox>
    </View>
  );

  const expandRow = (key: string, title: string, sub: string, body: React.ReactNode) => {
    const open = openRow === key;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.expandHead} activeOpacity={0.7} onPress={() => setOpenRow(open ? null : key)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expandTitle}>{title}</Text>
            {!!sub && <Text style={styles.expandSub}>{sub}</Text>}
          </View>
          <Icon name={open ? 'expand-less' : 'chevron-right'} size={20} color={colors.muted} />
        </TouchableOpacity>
        {open && <View style={styles.expandBody}>{body}</View>}
      </View>
    );
  };

  const renderDetails = () => (
    <View>
      <InfoBox>{t('lifecycleDetailsHint')}</InfoBox>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleProductFacts')}</Text>
        <KV icon="category" label={t('factProductType')} value={productData?.productType || ''} />
        <KV icon="business" label={t('summaryBrand')} value={productData?.brandInfo?.name || ''} />
        <KV icon="tag" label={t('model')} value={productData?.model || ''} />
        <KV icon="palette" label={t('factColor')} value={productData?.color || ''} />
        <KV icon="straighten" label={t('factSize')} value={productData?.size || ''} />
        <KV icon="public" label={t('lifecycleCountryOfManufacture')} value={originCountry} />
        <KV icon="event" label={t('factManufactureDate')} value={productData?.manufactureDate || ''} />
        <KV icon="spa" label={t('summaryMaterial')} value={facts.material || ''} />
        <KV icon="checkroom" label={t('lifecycleFit')} value={facts.fit || ''} />
        <KV icon="water-drop" label={t('lifecycleWash')} value={facts.wash || ''} />
        <KV icon="shield" label={t('lifecycleDurability')} value={facts.durability || ''} />
      </View>
      {!!String(facts.traceableIdentity || productData?._id || '').trim() &&
        expandRow('about', t('lifecycleAboutProduct'), t('lifecycleAboutProductSub'),
          <Text style={styles.paragraph}>{facts.traceableIdentity || t('lifecycleAboutProductFallback')}</Text>)}
      {certifications.length > 0 &&
        expandRow('certs', t('lifecycleCertifications'), t('lifecycleCertificationsSub'),
          <View style={styles.chipWrap}>
            {certifications.map((c, i) => (
              <View key={i} style={styles.chip}>
                <Icon name="verified" size={13} color={colors.primary} />
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>)}
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
      <InfoBox>{t('lifecycleCareHint')}</InfoBox>
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
            <View key={i} style={styles.originRow}>
              <Icon name="place" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.originName}>{o.material || '—'}</Text>
                <Text style={styles.originSub}>{[o.country || o.origin, o.companyName].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {certifications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleCertifications')}</Text>
          <View style={styles.chipWrap}>
            {certifications.map((c, i) => (
              <View key={i} style={styles.certBadge}>
                <Icon name="verified" size={14} color={colors.primary} />
                <Text style={styles.certBadgeText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <InfoBox>{t('lifecycleResponsibleSourcing')}</InfoBox>
      {materials.length === 0 && materialOrigins.length === 0 && certifications.length === 0 && (
        <Text style={styles.emptyText}>{t('lifecycleNoData')}</Text>
      )}
    </View>
  );

  const renderDispose = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleExtendLife')}</Text>
        {disposeLinks.map((l) => (
          <TouchableOpacity
            key={l.key}
            style={styles.disposeRow}
            onPress={() => openUrl(l.url)}
            activeOpacity={l.url ? 0.7 : 1}
            disabled={!l.url}
          >
            <View style={styles.disposeIcon}><Icon name={l.icon} size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.disposeTitle}>{t(l.labelKey as any)}</Text>
              <Text style={styles.disposeSub}>{t(l.subKey as any)}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
      {(impact.co2Avoided || impact.waterSaved || impact.energySaved) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleSustainabilityImpact')}</Text>
          <View style={styles.tileRow}>
            {impact.co2Avoided ? (
              <View style={styles.tile}>
                <Icon name="eco" size={16} color={colors.success} />
                <Text style={styles.tileValue}>{impact.co2Avoided}</Text>
                <Text style={styles.tileLabel}>{t('lifecycleCo2Avoided')}</Text>
              </View>
            ) : null}
            {impact.waterSaved ? (
              <View style={styles.tile}>
                <Icon name="water-drop" size={16} color={colors.primary} />
                <Text style={styles.tileValue}>{impact.waterSaved}</Text>
                <Text style={styles.tileLabel}>{t('lifecycleWaterSaved')}</Text>
              </View>
            ) : null}
            {impact.energySaved ? (
              <View style={styles.tile}>
                <Icon name="bolt" size={16} color={colors.warning} />
                <Text style={styles.tileValue}>{impact.energySaved}</Text>
                <Text style={styles.tileLabel}>{t('lifecycleEnergySaved')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
      <InfoBox>{t('lifecycleDisposeHelp')}</InfoBox>
    </View>
  );

  const renderTraceability = () => (
    <View>
      <View style={styles.card}>
        <KV icon="place" label={t('lifecycleCountryOfOrigin')} value={originCountry} />
        <KV icon="hub" label={t('lifecycleMaterialOrigins')} value={originCountries.length ? `${originCountries.length} ${t('lifecycleCountries')}` : ''} />
        <KV icon="local-shipping" label={t('lifecycleShippingRoute')} value={[routeInfo.origin, routeInfo.destination].filter(Boolean).join(' → ') || routeInfo.mode || ''} />
        <KV icon="route" label={t('lifecycleDistanceTraveled')} value={esg.distance || ''} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleEnvImpact')}</Text>
        <KV icon="cloud" label={t('co2Production')} value={esg.co2Production || ''} />
        <KV icon="local-shipping" label={t('co2Transportation')} value={routeInfo.emissions || esg.co2Transportation || ''} />
      </View>
      <InfoBox>{t('lifecycleVerifiedData')}</InfoBox>
    </View>
  );

  const renderTab = () => {
    switch (tab) {
      case 'journey': return renderJourney();
      case 'details': return renderDetails();
      case 'care': return renderCare();
      case 'materials': return renderMaterials();
      case 'dispose': return renderDispose();
      case 'traceability': return renderTraceability();
      default: return null;
    }
  };

  const thumb = fileUrl(Array.isArray(productData?.images) && productData.images.length ? productData.images[0] : '');

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.goBack()}
      title={t('titleProductLifecycle')}
      flatContent
      bottomBar={user && user.actorKind !== 'Employee' ? 'product' : 'auto'}
      rightIcon={user ? 'heart' : 'notification'}
      isFavorite={isInAlbum}
      onToggleFavorite={toggleFavorite}
      product={productData}
    >
      <View style={styles.screen}>
        {/* Blue header — product thumbnail + name / model / id / authenticated. */}
        <View style={styles.header}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.headerThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.headerThumb, styles.headerThumbPlaceholder]}>
              <Icon name="inventory-2" size={22} color="rgba(255,255,255,0.6)" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{productData?.name || '—'}</Text>
            {!!productData?.model && <Text style={styles.headerMeta} numberOfLines={1}>Model: {productData.model}</Text>}
            {(productData?.pmc_code || productData?.token_id != null) && (
              <Text style={styles.headerMeta} numberOfLines={1}>ID: {productData?.pmc_code || productData?.token_id}</Text>
            )}
            <View style={styles.headerBadge}>
              <Icon name="verified" size={13} color="#fff" />
              <Text style={styles.headerBadgeText}>{t('overviewAuthenticated')}</Text>
            </View>
          </View>
        </View>

        {/* Rounded content sheet with the tab row + tab content. */}
        <View style={styles.sheet}>
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
          <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
            {renderTab()}
          </ScrollView>
        </View>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary,
  },
  headerThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  headerBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: spacing.md,
  },
  tabRow: { flexGrow: 0, marginBottom: spacing.sm },
  tabRowContent: { gap: spacing.xs, paddingHorizontal: spacing.lg },
  tabBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
  tabScroll: { flex: 1 },
  tabScrollContent: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  paragraph: { fontSize: 13, color: colors.text, lineHeight: 19 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#eaf3fb',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.primaryDark, lineHeight: 17 },
  // journey
  journeyItem: { flexDirection: 'row', gap: spacing.md },
  journeyLineCol: { alignItems: 'center', width: 30 },
  journeyDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  journeyBody: { flex: 1, paddingBottom: spacing.md },
  journeyHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyTitle: { fontSize: 14, fontWeight: '700', color: colors.heading },
  journeyDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  journeyDetail: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  journeyLink: { fontSize: 13, color: colors.accent, fontWeight: '600', paddingVertical: 3 },
  // key/value
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  kvLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  kvLabel: { fontSize: 12, color: colors.muted },
  kvValue: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'right' },
  // expand rows
  expandHead: { flexDirection: 'row', alignItems: 'center' },
  expandTitle: { fontSize: 13, fontWeight: '700', color: colors.heading },
  expandSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  expandBody: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  // care
  careRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  careItem: { width: 60, alignItems: 'center' },
  careLabel: { fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4 },
  tipText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  // materials
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  barLabel: { width: 90, fontSize: 12, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  barValue: { width: 40, fontSize: 12, color: colors.muted, textAlign: 'right' },
  originRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  originName: { fontSize: 13, fontWeight: '600', color: colors.text },
  originSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
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
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  certBadgeText: { fontSize: 11, color: colors.text, fontWeight: '500' },
  // dispose
  disposeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  disposeIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  disposeTitle: { fontSize: 13, fontWeight: '600', color: colors.heading },
  disposeSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  tileRow: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 3 },
  tileValue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 9, color: colors.muted, textAlign: 'center' },
});
