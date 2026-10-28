import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

// Small wrappers around the /engagement endpoints the consumer product pages
// share (scan summary, Product Album, Cart, Purchase).

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const tokenIdOf = (product: any) => (product?.token_id != null && product?.token_id !== '' ? product.token_id : null);

export const fileUrl = (f: string) => {
  if (!f) return '';
  if (/^https?:\/\//i.test(f)) return f;
  return `${API_BASE_URL}files/${String(f).replace(/^\/+/, '')}`;
};

export const firstImageOf = (product: any): string => {
  const imgs = product?.images;
  const list = Array.isArray(imgs) ? imgs : imgs && typeof imgs === 'object' ? Object.values(imgs) : [];
  const first = list.find((x: any) => typeof x === 'string' && x.trim());
  return first ? fileUrl(String(first)) : '';
};

export const formatPrice = (price: any, currency?: string) => {
  const n = Number(price);
  if (price == null || price === '' || !Number.isFinite(n)) return '';
  const cur = (currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n);
  } catch (e) {
    return `${n.toFixed(2)} ${cur}`;
  }
};

const snapshotOf = (product: any) => ({
  name: product?.name || '',
  model: product?.model || '',
  detail: product?.detail || '',
  images: Array.isArray(product?.images) ? product.images : [],
  brandInfo: {
    name: product?.brandInfo?.name || '',
    detail: product?.brandInfo?.detail || '',
    websiteUrl: product?.brandInfo?.websiteUrl || '',
    logoUrl: product?.brandInfo?.logoUrl || '',
  },
});

/** Full public product (with videos, price, brand) by product id + item number. */
export async function fetchPublicProduct(productId: string, tokenId: any): Promise<any | null> {
  try {
    const r = await fetch(`${API_BASE_URL}qrcode/public/${encodeURIComponent(String(productId))}/${encodeURIComponent(String(tokenId))}`);
    const j = await r.json();
    return r.ok && j?.status === 'success' ? j.data || null : null;
  } catch (e) {
    return null;
  }
}

export type Reaction = 'like' | 'dislike' | null;

export async function getReactionState(userId: string, product: any): Promise<{ reaction: Reaction; inCart: boolean }> {
  const tokenId = tokenIdOf(product);
  const headers = await authHeaders();
  const [reactionRes, cartRes] = await Promise.all([
    tokenId != null
      ? fetch(`${API_BASE_URL}engagement/product-reaction?user_id=${encodeURIComponent(userId)}&product_id=${encodeURIComponent(product._id)}&token_id=${encodeURIComponent(String(tokenId))}`)
          .then((r) => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    fetch(`${API_BASE_URL}engagement/cart/status?product_id=${encodeURIComponent(product._id)}&token_id=${encodeURIComponent(String(tokenId ?? ''))}`, { headers })
      .then((r) => r.json()).catch(() => ({})),
  ]);
  const r = (reactionRes as any)?.reaction;
  return { reaction: r === 'like' || r === 'dislike' ? r : null, inCart: !!(cartRes as any)?.added };
}

/**
 * Like = saved to the Product Album; Dislike = recorded and removed from the
 * album. Passing the current reaction again clears it.
 */
export async function setReaction(userId: string, product: any, reaction: Reaction): Promise<void> {
  const tokenId = tokenIdOf(product);
  const albumBody = JSON.stringify({ user_id: userId, product_id: product._id, token_id: tokenId, productSnapshot: snapshotOf(product) });
  const jsonHeaders = { 'Content-Type': 'application/json' };
  await Promise.all([
    tokenId != null
      ? fetch(`${API_BASE_URL}engagement/product-reaction`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ user_id: userId, product_id: product._id, token_id: tokenId, reaction: reaction || '' }),
        })
      : Promise.resolve(),
    fetch(`${API_BASE_URL}engagement/album`, {
      method: reaction === 'like' ? 'POST' : 'DELETE',
      headers: jsonHeaders,
      body: albumBody,
    }),
  ]);
}

export async function setInCart(product: any, inCart: boolean): Promise<void> {
  await fetch(`${API_BASE_URL}engagement/cart`, {
    method: inCart ? 'POST' : 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ product_id: product._id, token_id: tokenIdOf(product) }),
  });
}

export async function listAlbum(userId: string): Promise<any[]> {
  const r = await fetch(`${API_BASE_URL}engagement/album/list?user_id=${encodeURIComponent(userId)}`);
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j?.data) ? j.data : [];
}

export async function listCart(): Promise<any[]> {
  const r = await fetch(`${API_BASE_URL}engagement/cart`, { headers: await authHeaders() });
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j?.data) ? j.data : [];
}

export async function recordPurchase(userId: string, product: any): Promise<void> {
  await fetch(`${API_BASE_URL}engagement/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, product_id: product._id, token_id: tokenIdOf(product), productSnapshot: snapshotOf(product) }),
  });
}
