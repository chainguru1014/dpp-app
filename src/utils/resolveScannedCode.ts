import { API_BASE_URL } from '../config/api';

export type ManualCodeType = 'qrcode' | 'barcode' | 'rfid' | 'gs1dl' | 'nfc';

export type ResolveResult =
  | { kind: 'product'; productData: any }
  | { kind: 'transfer'; code: string };

const normalizeEncryptData = (value: string) => {
  let normalized = value.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch (e) {
    /* not URI-encoded */
  }
  return normalized.replace(/\s/g, '+').replace(/-/g, '+').replace(/_/g, '/');
};

const pmcLookup = async (rawValue: string, sourceType: string) => {
  const resp = await fetch(`${API_BASE_URL}pmc/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_type: sourceType, raw_value: rawValue }),
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
};

/**
 * Standalone code resolver shared by the Enter Code screen (and available to
 * any other non-camera entry point). Mirrors ScannerScreen.handleScannedCode's
 * network resolution — QR/legacy-encrypted/GS1-DL via qrcode endpoints, every
 * other identifier via the admin-curated pmc/lookup mapping — but carries no
 * component state. Records the scan (best-effort) and returns the product.
 */
export async function resolveScannedCode(
  value: string,
  type: ManualCodeType,
  opts: { userId?: string; expectedSecurityQrUrl?: string } = {}
): Promise<ResolveResult> {
  const scanned = String(value || '').trim();
  if (!scanned) throw new Error('Enter a code first.');

  let resp: any;
  let data: any;
  let resolvedIdentifierType: string = type;
  let encryptDataForRecord = '';

  if (type !== 'qrcode') {
    ({ resp, data } = await pmcLookup(scanned, type));
  } else {
    const transferMatch = scanned.match(/\/transfer\/([^/?#]+)/i);
    if (transferMatch) {
      return { kind: 'transfer', code: decodeURIComponent(transferMatch[1]) };
    }

    const productUrlMatch = scanned.match(/\/product\/([^/?#]+)\/([^/?#]+)/i);
    if (productUrlMatch) {
      resp = await fetch(`${API_BASE_URL}qrcode/resolve-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrUrl: scanned,
          expectedQrUrl: opts.expectedSecurityQrUrl || undefined,
        }),
      });
      data = await resp.json().catch(() => ({}));
    } else {
      let encryptData = scanned;
      if (encryptData.includes('qrcode=')) {
        const [rawParam] = encryptData.split('qrcode=').slice(1);
        encryptData = rawParam?.split('&')[0] || '';
      }
      encryptData = normalizeEncryptData(encryptData);
      encryptDataForRecord = encryptData;
      resp = await fetch(`${API_BASE_URL}qrcode/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptData }),
      });
      data = await resp.json().catch(() => ({}));

      if (!(resp.ok && data?.status === 'success')) {
        resolvedIdentifierType = 'gs1dl';
        ({ resp, data } = await pmcLookup(scanned, 'gs1dl'));
      }
    }
  }

  if (!(resp?.ok && data?.status === 'success')) {
    throw new Error(data?.message || 'No product found for this code.');
  }

  const productData = data.data;

  // Best-effort scan record.
  try {
    await fetch(`${API_BASE_URL}qrcode/scan/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productData?._id,
        token_id: productData?.token_id,
        pmc_code: productData?.pmc_code,
        identifier_type: resolvedIdentifierType,
        encryptData: encryptDataForRecord || productData?.scannedQRCode || scanned,
        user_id: opts.userId,
        source: 'scan',
      }),
    });
  } catch (e) {
    console.error('Failed to record scan:', e);
  }

  return {
    kind: 'product',
    productData: {
      ...productData,
      scannedQRCode: productData?.scannedQRCode || scanned,
      scannedAt: Date.now(),
    },
  };
}
