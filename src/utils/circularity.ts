// The four end-of-life services a product can offer: repair, resell, rent,
// recycle. Same shape and rules as the backend (utils/circularity.ts) and
// the admin panel (src/utils/circularity.js) — keep the three in step.
import type { TranslationKey } from '../i18n/translations';

export type ServiceKind = 'repair' | 'resell' | 'rent' | 'recycle';
export const SERVICE_KINDS: ServiceKind[] = ['repair', 'resell', 'rent', 'recycle'];

// Each service's web link as products stored it before `circularity` existed.
const LEGACY_URL_FIELD: Record<ServiceKind, string> = { repair: 'repairUrl', resell: 'reuseUrl', rent: 'rentalUrl', recycle: 'disposeUrl' };

export type Service = {
  kind: ServiceKind;
  enabled: boolean;
  summary: string;
  steps: string[];
  partnerName: string;
  url: string;
  email: string;
  phone: string;
  cost: string;
  time: string;
  note: string;
  acceptRequests: boolean;
};

// Icon and wording of each service (translation keys).
export const SERVICE_META: Record<ServiceKind, {
  icon: string; title: TranslationKey; cost: TranslationKey; time: TranslationKey; note: TranslationKey;
  button: TranslationKey; hint: TranslationKey;
}> = {
  repair: { icon: 'build', title: 'svcRepair', cost: 'svcRepairCost', time: 'svcRepairTime', note: 'svcRepairNote', button: 'svcRepairButton', hint: 'svcRepairHint' },
  resell: { icon: 'storefront', title: 'svcResell', cost: 'svcResellCost', time: 'svcResellTime', note: 'svcResellNote', button: 'svcResellButton', hint: 'svcResellHint' },
  rent: { icon: 'event-repeat', title: 'svcRent', cost: 'svcRentCost', time: 'svcRentTime', note: 'svcRentNote', button: 'svcRentButton', hint: 'svcRentHint' },
  recycle: { icon: 'recycling', title: 'svcRecycle', cost: 'svcRecycleCost', time: 'svcRecycleTime', note: 'svcRecycleNote', button: 'svcRecycleButton', hint: 'svcRecycleHint' },
};

const text = (value: any, max: number) => String(value == null ? '' : value).trim().slice(0, max);

const normalizeService = (kind: ServiceKind, raw: any, legacyUrl: any): Service => {
  const s = raw && typeof raw === 'object' ? raw : {};
  const url = text(s.url, 500) || text(legacyUrl, 500);
  return {
    kind,
    // A product that only ever had the link still offers the service.
    enabled: s.enabled === undefined ? !!url : !!s.enabled,
    summary: text(s.summary, 500),
    steps: (Array.isArray(s.steps) ? s.steps : []).map((step: any) => text(step, 240)).filter(Boolean).slice(0, 8),
    partnerName: text(s.partnerName, 120),
    url,
    email: text(s.email, 200),
    phone: text(s.phone, 60),
    cost: text(s.cost, 160),
    time: text(s.time, 160),
    note: text(s.note, 500),
    acceptRequests: !!s.acceptRequests,
  };
};

/** The services of a product a shopper can act on, in display order. */
export const readyServices = (product: any): Service[] => SERVICE_KINDS
  .map((kind) => normalizeService(kind, product?.circularity?.[kind], product?.disposal?.[LEGACY_URL_FIELD[kind]]))
  .filter((s) => s.enabled && !!(s.url || s.email || s.phone || s.acceptRequests || s.steps.length));

export type RequestStatus = 'new' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'cancelled';
export const STATUS_KEY: Record<RequestStatus, TranslationKey> = {
  new: 'svcStatusNew',
  accepted: 'svcStatusAccepted',
  in_progress: 'svcStatusInProgress',
  completed: 'svcStatusCompleted',
  declined: 'svcStatusDeclined',
  cancelled: 'svcStatusCancelled',
};
