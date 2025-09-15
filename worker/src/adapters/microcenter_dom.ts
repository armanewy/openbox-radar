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
};

function toStoreSlug(storeId: string): string {
  return storeId.replace(/^mc-/, '');
}

function parsePriceToCents(text: string): number | null {
  const m = text.replace(/[,\s]/g, '').match(/\$?(\d+(?:\.\d{2})?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * 100);
}

export async function fetchMicroCenterOpenBoxDOM(storeId: string): Promise<{ storeId: string; items: McItem[] }> {
  const slug = toStoreSlug(storeId);
  const now = new Date().toISOString();
  const items: McItem[] = [];

  const candidates: string[] = [
    `https://www.microcenter.com/search/search_results.aspx?Ntt=open%20box&storeid=${encodeURIComponent(slug)}`,
    `https://www.microcenter.com/site/stores/${encodeURIComponent(slug)}.aspx`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; OpenboxRadar/0.3)' } });
      if (!res.ok) continue;
      const html = await res.text();
      const { document } = parseHTML(html);

      const cards = document.querySelectorAll(
        '.product_wrapper, .product, .product_tile, .products .product, .productGrid .product, li.product'
      );

      for (const card of cards as any) {
        const a = card.querySelector('a[href*="/product/"]') || card.querySelector('a[href]');
        const titleEl = card.querySelector('.product_title, .details .name, .product_name, a');
        const priceEl = card.querySelector('.price, .price .value, [class*="price"]');

        const href = a?.getAttribute('href') || '';
        const title = (titleEl?.textContent || a?.textContent || '').trim();
        const priceText = (priceEl?.textContent || '').trim();
        const priceCents = parsePriceToCents(priceText || '');

        if (!href || !title || !priceCents) continue;
        const prodUrl = new URL(href, url).toString();

        items.push({
          retailer: 'microcenter',
          storeId,
          title,
          conditionLabel: 'Open-Box',
          priceCents,
          url: prodUrl,
          seenAt: now,
        });
        if (items.length >= 50) break;
      }

      if (items.length) break; // got something
    } catch {
      // Try next candidate
    }
  }

  return { storeId, items };
}

