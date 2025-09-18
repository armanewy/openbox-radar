import { bbyGet, chunk } from './client';

export type OpenBoxItem = {
  sku: string;
  title: string;
  storeId?: string | null;
  conditionLabel: string;
  conditionRank: 'new' | 'excellent' | 'satisfactory' | 'fair' | string;
  priceCents: number;
  url: string;
  seenAt: Date;
};

// NOTE: Adjust query path/params when you finalize exact endpoint usage
function buildOpenBoxQueryForSkus(skus: string[]) {
  const base = 'https://api.bestbuy.com/v1/products';
  const filter = `(sku in(${skus.join(',')}))`;
  const params = 'show=sku,name,regularPrice,salePrice,url&format=json';
  return `${base}${filter}?${params}`;
}

export async function fetchOpenBoxBySkus(skus: string[]): Promise<OpenBoxItem[]> {
  if (process.env.BESTBUY_ENABLED !== '1') return [];
  if (!skus.length) return [];

  const out: OpenBoxItem[] = [];
  for (const group of chunk(skus, 50)) {
    const url = buildOpenBoxQueryForSkus(group);
    const json: any = await bbyGet(url);
    const arr = (json.products || json.results || []) as any[];
    const items = arr.map((p) => ({
      sku: String(p.sku),
      title: p.name ?? p.title ?? 'Unknown',
      storeId: p.storeId ?? null,
      conditionLabel: p.conditionLabel ?? 'open-box',
      conditionRank: p.conditionRank ?? 'satisfactory',
      priceCents: Math.round(100 * (p.salePrice ?? p.price ?? p.regularPrice ?? 0)),
      url: p.url ?? p.links?.web ?? '',
      seenAt: new Date(),
    })) as OpenBoxItem[];
    out.push(...items);
  }
  return out;
}

