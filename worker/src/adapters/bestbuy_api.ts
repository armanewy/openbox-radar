// Best Buy Open Box (Buying Options) API adapter
// Uses official beta endpoints documented at bestbuyapis.github.io

export type BbyItem = {
  retailer: 'bestbuy';
  storeId: string; // Open Box API does not expose store granularity
  sku?: string;
  title: string;
  conditionLabel: string; // e.g., Open-Box Excellent / Open-Box Certified
  priceCents: number;
  url: string; // product web link
  seenAt: string;
  imageUrl?: string;
};

type OpenBoxOffer = {
  condition?: string; // 'excellent' | 'certified' | ... (per docs)
  prices?: { current?: number; regular?: number };
};

type OpenBoxResult = {
  sku?: string;
  names?: { title?: string };
  offers?: OpenBoxOffer[];
  links?: { web?: string; product?: string; addToCart?: string };
  images?: { standard?: string };
  prices?: { current?: number; regular?: number };
};

const API_ROOT = 'https://api.bestbuy.com';

function toTitleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickBestOffer(offers: OpenBoxOffer[] | undefined): OpenBoxOffer | undefined {
  if (!offers || offers.length === 0) return undefined;
  // Prefer explicit current price, otherwise first
  const withPrice = offers.find((o) => typeof o.prices?.current === 'number');
  return withPrice || offers[0];
}

function mapToItem(p: OpenBoxResult): BbyItem | null {
  const best = pickBestOffer(p.offers);
  const current = best?.prices?.current ?? p.prices?.current;
  const url = p.links?.web || p.links?.product;
  const title = p.names?.title;
  const condition = best?.condition ? toTitleCase(best.condition) : 'Unknown';
  if (!url || !title || !current) return null;
  return {
    retailer: 'bestbuy',
    storeId: 'bby-online',
    sku: p.sku,
    title,
    conditionLabel: `Open-Box ${condition}`,
    priceCents: Math.round(current * 100),
    url,
    seenAt: new Date().toISOString(),
    imageUrl: p.images?.standard,
  };
}

async function fetchJson(u: string) {
  const res = await fetch(u, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`BestBuy API ${res.status}`);
  return res.json();
}

export async function fetchBestBuyOpenBoxBySkus(apiKey: string, skus: string[]): Promise<{ storeId: string; items: BbyItem[] }>{
  if (!apiKey) throw new Error('BESTBUY_API_KEY missing');
  if (!skus.length) return { storeId: 'bby-online', items: [] };
  const query = `openBox(sku in(${skus.join(',')}))`;
  const u = `${API_ROOT}/beta/products/${encodeURI(query)}?apiKey=${encodeURIComponent(apiKey)}`;
  const json: any = await fetchJson(u);
  const results: OpenBoxResult[] = json?.results ?? [];
  const items = results.map(mapToItem).filter(Boolean) as BbyItem[];
  return { storeId: 'bby-online', items };
}

export async function fetchBestBuyOpenBoxByCategory(apiKey: string, categoryId: string, pageSize = 50): Promise<{ storeId: string; items: BbyItem[] }>{
  if (!apiKey) throw new Error('BESTBUY_API_KEY missing');
  if (!categoryId) return { storeId: 'bby-online', items: [] };
  const query = `openBox(categoryId=${categoryId})`;
  const u = `${API_ROOT}/beta/products/${encodeURI(query)}?apiKey=${encodeURIComponent(apiKey)}&pageSize=${encodeURIComponent(String(pageSize))}`;
  const json: any = await fetchJson(u);
  const results: OpenBoxResult[] = json?.results ?? [];
  const items = results.map(mapToItem).filter(Boolean) as BbyItem[];
  return { storeId: 'bby-online', items };
}
