import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, Platform, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import AppLayout from '../components/AppLayout';
import MediaSlider from '../components/MediaSlider';
import VideoPlayerModal from '../components/VideoPlayerModal';
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

// Care tips are derived from the product's selected wash/care symbols when the
// brand hasn't supplied its own maintenance.tips list.
const CARE_TIP_BY_ICON: Record<string, string> = {
  wash_30: 'Machine wash cold — maximum 30°C.',
  wash_40: 'Machine wash warm — maximum 40°C.',
  wash_50: 'Machine wash — maximum 50°C.',
  wash_60: 'Machine wash hot — maximum 60°C.',
  wash_70: 'Machine wash — maximum 70°C.',
  dry_clean_P: 'Professional dry clean only (perchloroethylene).',
  dry_clean_F: 'Professional dry clean only (hydrocarbon solvent).',
  iron_low: 'Iron on low heat (max 110°C), avoid steam.',
  iron_med: 'Iron on medium heat (max 150°C).',
  iron_high: 'Iron on high heat (max 200°C).',
  bleach_no: 'Do not bleach.',
  bleach_any: 'Any bleach may be used when needed.',
  tumble_dry_low: 'Tumble dry on low heat.',
  tumble_dry_high: 'Tumble dry on a normal / high setting.',
};

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

function Row({ label, value, icon, chevron }: { label: string; value: string; icon?: string; chevron?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.itemRow}>
      {!!icon && (
        <View style={styles.itemIcon}><Icon name={icon} size={16} color={colors.primary} /></View>
      )}
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue} numberOfLines={1}>{value}</Text>
      {chevron && <Icon name="chevron-right" size={16} color={colors.muted} />}
    </View>
  );
}

export default function ProductLifecycleScreen({ navigation, route, user, onLogout }: Props) {
  const { t } = useI18n();
  const [productData, setProductData] = useState<any>(route?.params?.productData || {});
  const [tab, setTab] = useState<TabKey>('journey');
  // Journey stages are all collapsed by default — a down-chevron invites the tap.
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [isInAlbum, setIsInAlbum] = useState(false);
  const [isBrandFollowed, setIsBrandFollowed] = useState(false);

  const productId = route?.params?.productId ?? productData?._id;
  const qrcodeId = route?.params?.qrcodeId ?? productData?.token_id;
  const brandWebsite = String(productData?.brandInfo?.websiteUrl || '').trim();

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
    if (brandWebsite) {
      fetch(`${API_BASE_URL}engagement/follow/status?user_id=${encodeURIComponent(String(user._id))}&brandWebsiteUrl=${encodeURIComponent(brandWebsite)}`)
        .then((r) => r.json())
        .then((j) => setIsBrandFollowed(!!j?.following))
        .catch(() => {});
    }
  }, [user?._id, productData?._id, productData?.token_id, brandWebsite]);

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

  const brandInfoText = () => {
    const b = productData?.brandInfo || {};
    return [
      `Product: ${productData?.name || '-'}`,
      productData?.model ? `Model: ${productData.model}` : '',
      productData?.pmc_code ? `ID: ${productData.pmc_code}` : '',
      b.name ? `Brand: ${b.name}` : '',
      b.websiteUrl ? `Website: ${b.websiteUrl}` : '',
    ].filter(Boolean).join('\n');
  };

  const openUrl = (url?: string) => {
    if (!url) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (Platform.OS === 'web') (globalThis as any)?.open?.(safe, '_blank', 'noopener,noreferrer');
    else Linking.openURL(safe).catch(() => {});
  };

  // "More" bottom-sheet actions — mirrors ResultScreen so the sheet works here too.
  const onActionMenuPress = async (key: string) => {
    switch (key) {
      case 'saveProductInfo':
      case 'copyProductInfo':
        try {
          const text = brandInfoText();
          if (Platform.OS === 'web' && (globalThis as any)?.navigator?.clipboard) {
            await (globalThis as any).navigator.clipboard.writeText(text);
          } else {
            Clipboard.setString(text);
          }
          Alert.alert(t('success'), t('copyProductInfo'));
        } catch (e) { /* ignore */ }
        break;
      case 'sendProductInfo':
        navigation.navigate('SendProductInfo', { product: productData, infoText: brandInfoText() });
        break;
      case 'toggleAlbum':
        toggleFavorite();
        break;
      case 'connectBrand':
        openUrl(brandWebsite);
        break;
      case 'toggleFollowBrand': {
        if (!user?._id || !brandWebsite) return;
        const b = productData?.brandInfo || {};
        const next = !isBrandFollowed;
        setIsBrandFollowed(next);
        try {
          await fetch(`${API_BASE_URL}engagement/follow`, {
            method: next ? 'POST' : 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user._id,
              brandWebsiteUrl: brandWebsite,
              brandName: b.name || '',
              brandDetail: b.detail || '',
              brandLogoUrl: b.logoUrl || '',
            }),
          });
        } catch (e) {
          setIsBrandFollowed(!next);
        }
        break;
      }
      default:
        break;
    }
  };

  const facts = productData?.detailFacts || {};
  const maintenance = productData?.maintenance || {};
  const careIcons = toStrArray(maintenance.iconIds);
  const manualCareTips = toStrArray(maintenance.tips);
  // Prefer the brand's own tips; otherwise generate them from the care symbols.
  const careTips = manualCareTips.length
    ? manualCareTips
    : careIcons.map((id) => CARE_TIP_BY_ICON[id] || `${getCareSymbolLabel(id)}.`);
  const materialSize = productData?.materialSize || {};
  const materials = toArray(materialSize.materials);
  // certifications: legacy string[] OR {icon,title,content}[].
  const certifications: { icon?: string; title: string; content?: string }[] = toArray(productData?.certifications)
    .map((c: any) => (typeof c === 'string' ? { title: c } : c))
    .filter((c: any) => c && (c.title || c.content));
  const esg = productData?.traceabilityEsg || {};
  const materialOrigins = toArray(esg.materialOrigins);
  const disposal = productData?.disposal || {};
  const impactRaw = productData?.sustainabilityImpact || {};
  const impactItems: { icon?: string; value: string; label: string; description?: string }[] =
    Array.isArray(impactRaw.items) && impactRaw.items.length
      ? impactRaw.items
      : [
          impactRaw.co2Avoided && { value: impactRaw.co2Avoided, label: t('lifecycleCo2Avoided'), icon: 'eco' },
          impactRaw.waterSaved && { value: impactRaw.waterSaved, label: t('lifecycleWaterSaved'), icon: 'water-drop' },
          impactRaw.energySaved && { value: impactRaw.energySaved, label: t('lifecycleEnergySaved'), icon: 'bolt' },
        ].filter(Boolean) as any;
  const routeInfo = esg.route || {};
  const originCountry = esg.originCountry || esg.madeIn || '';
  const originCountries = Array.from(
    new Set(materialOrigins.map((o: any) => o.country || o.origin).filter(Boolean))
  ) as string[];

  const disposeLinks = useMemo(
    () => [
      { key: 'reuse', icon: 'volunteer-activism', labelKey: 'lifecycleReuse', subKey: 'lifecycleReuseSub', url: disposal.reuseUrl },
      { key: 'repair', icon: 'build', labelKey: 'lifecycleRepair', subKey: 'lifecycleRepairSub', url: disposal.repairUrl },
      { key: 'rental', icon: 'storefront', labelKey: 'lifecycleRentResell', subKey: 'lifecycleRentResellSub', url: disposal.rentalUrl },
      { key: 'dispose', icon: 'delete-outline', labelKey: 'lifecycleDisposeResponsibly', subKey: 'lifecycleDisposeResponsiblySub', url: disposal.disposeUrl },
    ],
    [disposal.reuseUrl, disposal.repairUrl, disposal.rentalUrl, disposal.disposeUrl]
  );

  // ---- tab bodies ----

  // Per-stage expandable detail, assembled from the product's own data. Returns
  // null when this product carries nothing for the stage (row stays collapsed
  // with just its summary line).
  const renderStageDetail = (key: string): React.ReactNode => {
    if (key === 'materials') {
      if (!materials.length && !materialOrigins.length) return null;
      return (
        <View style={styles.jDetail}>
          {materials.map((m: any, i: number) => (
            <Row key={i} label={m.material || '—'} value={m.percent != null ? `${m.percent}%` : ''} />
          ))}
          {materialOrigins.length > 0 && (
            <Row label={t('lifecycleMaterialOrigins')} value={originCountries.join(', ') || String(materialOrigins.length)} />
          )}
        </View>
      );
    }
    if (key === 'manufacturing') {
      const rows: [string, string][] = [
        [t('lifecycleCountryOfManufacture'), originCountry],
        [t('factManufactureDate'), productData?.manufactureDate || ''],
        [t('summaryBrand'), productData?.brandInfo?.name || ''],
        [t('co2Production'), esg.co2Production || ''],
      ].filter(([, v]) => !!v) as [string, string][];
      if (!rows.length) return null;
      return (
        <View style={styles.jDetail}>
          {rows.map(([l, v]) => <Row key={l} label={l} value={v} />)}
        </View>
      );
    }
    if (key === 'transportation') {
      const route = [routeInfo.origin, routeInfo.destination].filter(Boolean).join(' → ');
      if (!esg.distance && !route && !routeInfo.mode && !routeInfo.emissions && !esg.co2Transportation) return null;
      return (
        <View style={styles.jDetail}>
          <Row label={t('lifecycleShippingDistance')} value={esg.distance || ''} />
          <Row label={t('lifecycleRoute')} value={route} />
          <Row label={t('lifecycleTransportMode')} value={routeInfo.mode || ''} />
          <Row label={t('lifecycleEstEmissions')} value={routeInfo.emissions || esg.co2Transportation || ''} />
        </View>
      );
    }
    if (key === 'use') {
      const rows: [string, string][] = [
        [t('summaryWarrantyStatus'), [productData?.warrantyStatus, productData?.warrantyValidYears ? `· ${productData.warrantyValidYears}y` : '']
          .filter(Boolean).join(' ')],
        [t('lifecycleDurability'), facts.durability || ''],
        [t('lifecycleWash'), facts.wash || ''],
        [t('lifecycleCareSymbols'), careIcons.length ? String(careIcons.length) : ''],
      ].filter(([, v]) => !!v) as [string, string][];
      if (!rows.length) return null;
      return (
        <View style={styles.jDetail}>
          {rows.map(([l, v]) => <Row key={l} label={l} value={v} />)}
        </View>
      );
    }
    if (key === 'endOfLife') {
      const links = disposeLinks.filter((l) => l.url);
      if (!links.length && !impactItems.length) return null;
      return (
        <View style={styles.jDetail}>
          {links.map((l) => (
            <TouchableOpacity key={l.key} onPress={() => openUrl(l.url)}>
              <Text style={styles.jLink}>{t(l.labelKey as any)}</Text>
            </TouchableOpacity>
          ))}
          {impactItems.map((it, i) => (
            <Row key={`imp-${i}`} label={it.label} value={it.value} />
          ))}
        </View>
      );
    }
    return null;
  };

  const renderJourney = () => (
    <View style={{ paddingTop: spacing.xxl }}>
      {JOURNEY_STAGES.map((s, i) => {
        const open = openStage === s.key;
        const detail = renderStageDetail(s.key);
        return (
          <View key={s.key} style={styles.jItem}>
            <View style={styles.jRail}>
              <View style={styles.jDot}><Icon name={s.icon} size={24} color="#fff" /></View>
              {i < JOURNEY_STAGES.length - 1 && <View style={styles.jLine} />}
            </View>
            <TouchableOpacity style={styles.jBody} activeOpacity={0.7} onPress={() => setOpenStage(open ? null : s.key)}>
              <View style={styles.jTitleRow}>
                <Text style={styles.jTitle}>{t(s.labelKey as any)}</Text>
                <Icon name={open ? 'expand-less' : 'expand-more'} size={22} color={colors.muted} />
              </View>
              <Text style={styles.jDesc}>{t(s.descKey as any)}</Text>
              {open && (detail || (
                <View style={styles.jDetail}><Text style={styles.jDetailEmpty}>{t('lifecycleNoData')}</Text></View>
              ))}
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={styles.hintCard}>
        <Icon name="info-outline" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.hintTitle}>{t('lifecycleJourneyHintTitle')}</Text>
          <Text style={styles.hintBody}>{t('lifecycleJourneyHint')}</Text>
        </View>
      </View>
    </View>
  );

  const expandRow = (key: string, title: string, sub: string, icon: string, body: React.ReactNode) => {
    const open = openRow === key;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.expandHead} activeOpacity={0.7} onPress={() => setOpenRow(open ? null : key)}>
          <View style={styles.expandIcon}><Icon name={icon} size={16} color={colors.primary} /></View>
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
      <View style={styles.hintCard}>
        <Icon name="info-outline" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.hintTitle}>{t('lifecycleDetailsHintTitle')}</Text>
          <Text style={styles.hintBody}>{t('lifecycleDetailsHint')}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleProductFacts')}</Text>
        <Row icon="category" label={t('factProductType')} value={productData?.productType || ''} />
        <Row icon="business" label={t('summaryBrand')} value={productData?.brandInfo?.name || ''} />
        <Row icon="sell" label={t('model')} value={productData?.model || ''} />
        <Row icon="palette" label={t('factColor')} value={productData?.color || ''} />
        <Row icon="straighten" label={t('factSize')} value={productData?.size || ''} />
        <Row icon="public" label={t('lifecycleCountryOfManufacture')} value={originCountry} />
        <Row icon="event" label={t('factManufactureDate')} value={productData?.manufactureDate || ''} />
        <Row icon="spa" label={t('summaryMaterial')} value={facts.material || ''} />
      </View>
      {expandRow('about', t('lifecycleAboutProduct'), t('lifecycleAboutProductSub'), 'verified-user',
        <Text style={styles.paragraph}>{facts.traceableIdentity || t('lifecycleAboutProductFallback')}</Text>)}
      {expandRow('certs', t('lifecycleCertifications'), t('lifecycleCertificationsSub'), 'workspace-premium',
        certifications.length ? (
          <View style={{ gap: spacing.sm }}>
            {certifications.map((c, i) => (
              <View key={i} style={styles.certLine}>
                <View style={styles.certLineIcon}>
                  {c.icon ? (
                    <Image source={{ uri: fileUrl(c.icon) }} style={styles.certImg} resizeMode="contain" />
                  ) : (
                    <Icon name="verified" size={16} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.certLineTitle}>{c.title}</Text>
                  {!!c.content && <Text style={styles.certLineBody}>{c.content}</Text>}
                </View>
              </View>
            ))}
          </View>
        ) : <Text style={styles.paragraph}>{t('lifecycleNoData')}</Text>)}
    </View>
  );

  const renderCare = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleCareSymbols')}</Text>
        {careIcons.length > 0 ? (
          <View style={styles.careRow}>
            {careIcons.map((id, i) => (
              <View key={`${id}-${i}`} style={styles.careItem}>
                <CareSymbol iconId={id} bare color="#000" />
                <Text style={styles.careLabel} numberOfLines={2}>{getCareSymbolLabel(id)}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={styles.emptyText}>{t('lifecycleNoData')}</Text>}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleCareTips')}</Text>
        {careTips.length > 0 ? careTips.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Icon name="check-circle" size={16} color={colors.primary} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        )) : <Text style={styles.emptyText}>{maintenance.description || t('lifecycleNoData')}</Text>}
        {!!maintenance.description && careTips.length > 0 && <Text style={styles.paragraph}>{maintenance.description}</Text>}
      </View>
      <View style={styles.leafCard}>
        <View style={styles.leafIcon}><Icon name="eco" size={18} color={colors.success} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.leafTitle}>{t('lifecycleCareHelpTitle')}</Text>
          <Text style={styles.leafBody}>{t('lifecycleCareHint')}</Text>
          <Text style={styles.leafLink}>{t('lifecycleLearnCare')}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </View>
    </View>
  );

  const renderMaterials = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleComposition')}</Text>
        {materials.length > 0 ? materials.map((m: any, i: number) => (
          <Bar key={i} label={m.material || '—'} percent={Number(m.percent) || 0} />
        )) : <Text style={styles.emptyText}>{t('lifecycleNoData')}</Text>}
      </View>
      {materialOrigins.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleMaterialOrigins')}</Text>
          {materialOrigins.map((o: any, i: number) => (
            <View key={i} style={styles.originRow}>
              <View style={styles.originIcon}>
                {o.icon ? (
                  <Image source={{ uri: fileUrl(o.icon) }} style={styles.originImg} resizeMode="contain" />
                ) : (
                  <Icon name="recycling" size={16} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.originName}>{o.material || '—'}</Text>
                <Text style={styles.originSub}>{[o.country || o.origin, o.companyName].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.muted} />
            </View>
          ))}
        </View>
      )}
      {certifications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleCertifications')}</Text>
          <View style={styles.certRow}>
            {certifications.map((c, i) => (
              <View key={i} style={styles.certBadge}>
                {c.icon ? (
                  <Image source={{ uri: fileUrl(c.icon) }} style={styles.certImg} resizeMode="contain" />
                ) : (
                  <Icon name="verified" size={30} color={colors.primary} />
                )}
                <Text style={styles.certBadgeText} numberOfLines={2}>{c.title}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={styles.leafCard}>
        <View style={styles.leafIcon}><Icon name="eco" size={18} color={colors.success} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.leafTitle}>{t('lifecycleResponsibleSourcingTitle')}</Text>
          <Text style={styles.leafBody}>{t('lifecycleResponsibleSourcing')}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </View>
    </View>
  );

  const renderDispose = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleExtendLife')}</Text>
        {disposeLinks.map((l) => (
          <TouchableOpacity key={l.key} style={styles.disposeRow} onPress={() => openUrl(l.url)} activeOpacity={l.url ? 0.7 : 1} disabled={!l.url}>
            <View style={styles.disposeIcon}><Icon name={l.icon} size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.disposeTitle}>{t(l.labelKey as any)}</Text>
              <Text style={styles.disposeSub}>{t(l.subKey as any)}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
      {impactItems.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('lifecycleSustainabilityImpact')}</Text>
          <View style={styles.tileRow}>
            {impactItems.map((it, i) => (
              <View key={i} style={styles.tile}>
                {it.icon && /^[a-z-]+$/.test(it.icon) ? (
                  <Icon name={it.icon} size={28} color={colors.success} />
                ) : it.icon ? (
                  <Image source={{ uri: fileUrl(it.icon) }} style={styles.tileImg} resizeMode="contain" />
                ) : (
                  <Icon name="eco" size={28} color={colors.success} />
                )}
                <Text style={styles.tileValue}>{it.value}</Text>
                <Text style={styles.tileLabel}>{it.label}</Text>
                {!!it.description && <Text style={styles.tileDesc} numberOfLines={2}>{it.description}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={styles.leafCard}>
        <View style={styles.leafIcon}><Icon name="help-outline" size={18} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.leafTitle}>{t('lifecycleNeedHelpTitle')}</Text>
          <Text style={styles.leafBody}>{t('lifecycleDisposeHelp')}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </View>
    </View>
  );

  const renderTraceability = () => (
    <View>
      <View style={styles.card}>
        <Row icon="place" label={t('lifecycleCountryOfOrigin')} value={originCountry} chevron />
        <Row icon="hub" label={t('lifecycleMaterialOrigins')} value={originCountries.length ? `${originCountries.length} ${t('lifecycleCountries')}` : ''} chevron />
        <Row icon="local-shipping" label={t('lifecycleShippingRoute')} value={[routeInfo.origin, routeInfo.destination].filter(Boolean).join(' → ') || routeInfo.mode || t('lifecycleViewJourney')} chevron />
        <Row icon="route" label={t('lifecycleDistanceTraveled')} value={esg.distance || ''} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('lifecycleEnvImpact')}</Text>
        <Row icon="cloud" label={t('co2Production')} value={esg.co2Production || ''} />
        <Row icon="local-shipping" label={t('co2Transportation')} value={routeInfo.emissions || esg.co2Transportation || ''} />
      </View>
      <View style={styles.leafCard}>
        <View style={styles.leafIcon}><Icon name="verified-user" size={18} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.leafTitle}>{t('lifecycleVerifiedDataTitle')}</Text>
          <Text style={styles.leafBody}>{t('lifecycleVerifiedData')}</Text>
          <Text style={styles.leafLink}>{t('lifecycleLearnMore')}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </View>
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

  const sliderImages = toStrArray(productData?.images);
  const sliderVideos = toArray(productData?.videos);
  const hasMedia = sliderImages.length > 0 || sliderVideos.length > 0;

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={() => navigation.navigate(user?.actorKind === 'Employee' ? 'EmployeeHome' : 'Scanner')}
      title={t('titleProductLifecycle')}
      flatContent
      bottomBar={user && user.actorKind !== 'Employee' ? 'product' : 'auto'}
      rightIcon={user ? 'heart' : 'notification'}
      isFavorite={isInAlbum}
      onToggleFavorite={toggleFavorite}
      product={productData}
      isProductDetailPage
      isInAlbum={isInAlbum}
      isBrandFollowed={isBrandFollowed}
      onActionMenuPress={onActionMenuPress}
    >
      <View style={styles.screen}>
        {/* Blue header — product image slider + name / model / id + Authenticated card. */}
        <View style={styles.header}>
          <View style={styles.headerMedia}>
            {hasMedia ? (
              <MediaSlider
                images={sliderImages}
                videos={sliderVideos}
                hideHeader
                flush
                maxHeight={112}
                getFileUrl={fileUrl}
                watchLabel={t('watchVideo')}
                onPlayVideo={setPlayingVideoId}
              />
            ) : (
              <View style={[styles.headerThumb, styles.headerThumbPlaceholder]}>
                <Icon name="inventory-2" size={26} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={2}>{productData?.name || '—'}</Text>
            {!!productData?.model && <Text style={styles.headerMeta} numberOfLines={1}>Model: {productData.model}</Text>}
            {(productData?.pmc_code || productData?.token_id != null) && (
              <Text style={styles.headerMeta} numberOfLines={1}>ID: {productData?.pmc_code || productData?.token_id}</Text>
            )}
            <View style={styles.authCard}>
              <View style={styles.authCheck}><Icon name="check" size={12} color={colors.primary} /></View>
              <View>
                <Text style={styles.authTitle}>{t('overviewAuthenticated')}</Text>
                <Text style={styles.authSub}>{t('lifecycleVerifiedByBrand')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rounded sheet: underline tab row + tab content. */}
        <View style={styles.sheet}>
          <View style={styles.tabRow}>
            {TABS.map((tb) => (
              <TouchableOpacity key={tb.key} style={styles.tabBtn} onPress={() => setTab(tb.key)} activeOpacity={0.7}>
                <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]} numberOfLines={1}>{t(tb.labelKey as any)}</Text>
                {tab === tb.key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
            {renderTab()}
          </ScrollView>
        </View>
      </View>

      <VideoPlayerModal
        visible={!!playingVideoId}
        videoId={playingVideoId}
        onClose={() => setPlayingVideoId(null)}
      />
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerMedia: { width: 120 },
  headerThumb: { width: 120, height: 112, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerMeta: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 3, lineHeight: 16 },
  authCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  authCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  authSub: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xs,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2 },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '70%',
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  tabScroll: { flex: 1 },
  tabScrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow(1),
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  paragraph: { fontSize: 13, color: colors.text, lineHeight: 19 },
  emptyText: { fontSize: 13, color: colors.muted, paddingVertical: spacing.sm },
  // journey
  jItem: { flexDirection: 'row', gap: spacing.lg },
  jRail: { alignItems: 'center', width: 48 },
  jDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jLine: { flex: 1, width: 3, backgroundColor: colors.primary, marginVertical: 6, minHeight: 24, borderRadius: 2 },
  jBody: { flex: 1, paddingBottom: spacing.xxl },
  jTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  jDesc: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
  jDetail: { marginTop: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  jDetailEmpty: { fontSize: 12, color: colors.muted },
  jLink: { fontSize: 13, color: colors.accent, fontWeight: '600', paddingVertical: 3 },
  // rows
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 12, color: colors.muted },
  itemValue: { fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'right' },
  // expand
  expandHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expandIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  expandTitle: { fontSize: 13, fontWeight: '700', color: colors.heading },
  expandSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  expandBody: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  // care
  careRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-start', alignItems: 'flex-start' },
  careItem: { width: 62, alignItems: 'center', justifyContent: 'flex-start' },
  careLabel: { fontSize: 10, color: colors.text, textAlign: 'center', marginTop: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 5 },
  tipText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  // materials
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  barLabel: { width: 96, fontSize: 12, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  barValue: { width: 40, fontSize: 12, color: colors.muted, textAlign: 'right' },
  originRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  originIcon: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  originImg: { width: 20, height: 20 },
  originName: { fontSize: 13, fontWeight: '600', color: colors.text },
  originSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  certRow: { flexDirection: 'row', gap: spacing.sm },
  certBadge: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  certBadgeText: { fontSize: 10, color: colors.text, fontWeight: '500', textAlign: 'center' },
  certImg: { width: 34, height: 34 },
  certLine: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  certLineIcon: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  certLineTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  certLineBody: { fontSize: 11, color: colors.muted, marginTop: 1 },
  tileImg: { width: 32, height: 32 },
  tileDesc: { fontSize: 8, color: colors.placeholder, textAlign: 'center', marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { fontSize: 11, color: colors.text },
  // dispose
  disposeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  disposeIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  disposeTitle: { fontSize: 13, fontWeight: '600', color: colors.heading },
  disposeSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  tileRow: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  tileValue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  tileLabel: { fontSize: 9, color: colors.muted, textAlign: 'center' },
  // info / leaf cards
  hintCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#eaf3fb',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  hintTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  hintBody: { fontSize: 12, color: colors.primaryDark, lineHeight: 17, marginTop: 2 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  infoCardIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: colors.heading },
  infoCardBody: { fontSize: 11, color: colors.muted, marginTop: 1 },
  leafCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#eaf3fb',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  leafIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  leafTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  leafBody: { fontSize: 12, color: colors.primaryDark, lineHeight: 17, marginTop: 2 },
  leafLink: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 4 },
});
