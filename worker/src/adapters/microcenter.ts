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
  // Expect storeId like "mc-cambridge" → "cambridge"
  return storeId.replace(/^mc-/, '');
}

function parsePriceToCents(text: string): number | null {
  const m = text.replace(/[,\s]/g, '').match(/\$?(\d+(?:\.\d{2})?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * 100);
}

export async function fetchMicroCenterOpenBox(storeId: string): Promise<{ storeId: string; items: McItem[] }> {
  const slug = toStoreSlug(storeId);
  const now = new Date().toISOString();
  const items: McItem[] = [];

  // Try a simple search for "open box" scoped to store; Micro Center pages often render server-side
  const candidates: string[] = [
    `https://www.microcenter.com/search/search_results.aspx?Ntt=open%20box&storeid=${encodeURIComponent(slug)}`,
    `https://www.microcenter.com/site/stores/${encodeURIComponent(slug)}.aspx`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; OpenboxRadar/0.1)' } });
      if (!res.ok) continue;
      const html = await res.text();

      // Heuristic parse: look for product cards and extract title, price, and link
      const cardRegex = /<a[^>]+class="?product_link[^"]*"?[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<span[^>]*class="?price"?[^>]*>([\s\S]*?)<\/span>)/gi;
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = cardRegex.exec(html)) && count < 25) {
        const prodUrl = new URL(m[1], url).toString();
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        const priceText = m[3].replace(/<[^>]+>/g, '').trim();
        const priceCents = parsePriceToCents(priceText);
        if (!title || !priceCents) continue;
        items.push({
          retailer: 'microcenter',
          storeId,
          title,
          conditionLabel: 'Open-Box',
          priceCents,
          url: prodUrl,
          seenAt: now,
        });
        count++;
      }

      if (items.length) break; // got something from this page
    } catch (e) {
      // ignore and try next candidate
    }
  }

  return { storeId, items };
}

