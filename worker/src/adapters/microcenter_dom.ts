import { parseHTML } from 'linkedom';

export type McItem = {
  retailer: 'microcenter';
  storeId: string;
  sku?: string;
  title: string;
  conditionLabel: string;
  priceCents: number;
  url: string;
  seenAt: string;
  imageUrl?: string;
};

function toStoreSlug(storeId: string): string {
  return storeId.replace(/^mc-/, '');
}

function parsePriceToCents(text: string): number | null {
  const m = text.replace(/[,\s]/g, '').match(/\$?(\d+(?:\.\d{2})?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * 100);
}

function parseSkuFromUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    const qs = url.searchParams.get('sku');
    if (qs) return qs;
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === 'product');
    if (idx >= 0 && parts[idx + 1]) {
      const next = parts[idx + 1];
      const sku = next.replace(/[^0-9]/g, '');
      if (sku) return sku;
    }
    const last = parts[parts.length - 1];
    if (last) {
      const digits = last.replace(/[^0-9]/g, '');
      if (digits) return digits;
    }
  } catch {}
  return undefined;
}

function normalizeImage(url: string | null | undefined, base: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^https?:/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, base).toString();
  } catch {}
  return undefined;
}

export async function fetchMicroCenterOpenBoxDOM(storeId: string): Promise<{ storeId: string; items: McItem[] }> {
  const slug = toStoreSlug(storeId);
  const now = new Date().toISOString();
  const items: McItem[] = [];
  const seen = new Set<string>();

  const candidates: string[] = [
    `https://www.microcenter.com/search/search_results.aspx?Ntt=open%20box&storeid=${encodeURIComponent(slug)}`,
    `https://www.microcenter.com/search/search_results.aspx?Ntt=open-box&storeid=${encodeURIComponent(slug)}`,
    `https://www.microcenter.com/site/stores/${encodeURIComponent(slug)}.aspx`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; OpenboxRadar/0.4)' } });
      if (!res.ok) continue;
      const html = await res.text();
      const { document } = parseHTML(html);

      const cards = document.querySelectorAll(
        '.product_wrapper, .product, .product_tile, .products .product, .productGrid .product, li.product, .productGridItem'
      );

      for (const card of cards as any) {
        const a = card.querySelector('a[href*="/product/"]') || card.querySelector('a[href]');
        const titleEl = card.querySelector('.product_title, .details .name, .product_name, .productTitle, a');
        const priceEl = card.querySelector('.price, .price .value, [class*="price"], .price-wrapper');
        const conditionEl =
          card.querySelector('.product_condition, .condition, .productCondition') || card.querySelector('.product_promo');
        const imgEl = card.querySelector('img');

        const href = a?.getAttribute('href') || '';
        const title = (titleEl?.textContent || a?.textContent || '').replace(/\s+/g, ' ').trim();
        const priceText = (priceEl?.textContent || '').trim();
        const priceCents = parsePriceToCents(priceText || '');

        if (!href || !title || !priceCents) continue;
        const prodUrl = new URL(href, url).toString();
        const sku = parseSkuFromUrl(prodUrl);
        const key = sku || prodUrl;
        if (seen.has(key)) continue;
        seen.add(key);

        const condition =
          (conditionEl?.textContent || '').trim() ||
          (title.toLowerCase().includes('refurb') ? 'Refurbished/Open-Box' : 'Open-Box');

        const imageUrl =
          imgEl?.getAttribute('data-src') ||
          imgEl?.getAttribute('srcset')?.split(' ')?.[0] ||
          imgEl?.getAttribute('src') ||
          undefined;

        items.push({
          retailer: 'microcenter',
          storeId,
          sku,
          title,
          conditionLabel: condition,
          priceCents,
          url: prodUrl,
          seenAt: now,
          imageUrl: normalizeImage(imageUrl, prodUrl),
        });
        if (items.length >= 60) break;
      }

      if (items.length) break; // got something
    } catch (err) {
      console.warn('[microcenter] fetch failed for', storeId, url, err);
    }
  }

  return { storeId, items };
}

