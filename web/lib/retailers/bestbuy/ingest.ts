import { db } from '@/lib/drizzle/db';
import { inventory } from '@/lib/drizzle/schema';
import { fetchOpenBoxBySkus } from './adapter';
import { classifyProductType } from '@/lib/productClassifier';

const TTL_HOURS = 71; // stay under 72h
const ttl = (h: number) => new Date(Date.now() + h * 3600 * 1000);

function normalizeRank(label: string): 'certified'|'excellent'|'satisfactory'|'fair'|'unknown' {
  const s = label.toLowerCase();
  if (s.includes('certified')) return 'certified';
  if (s.includes('excellent')) return 'excellent';
  if (s.includes('satisfactory')) return 'satisfactory';
  if (s.includes('fair')) return 'fair';
  return 'unknown';
}

export async function ingestBestBuyForSkus(skus: string[]) {
  const items = await fetchOpenBoxBySkus(skus);
  if (!items.length) return { inserted: 0 };

  let inserted = 0;
  for (const it of items) {
    const rank = normalizeRank(it.conditionLabel);
    await db.insert(inventory).values({
      retailer: 'bestbuy' as any,
      store_id: it.storeId ?? '',
      sku: it.sku,
      title: it.title,
      condition_label: it.conditionLabel,
      condition_rank: rank as any,
      price_cents: it.priceCents,
      url: it.url,
      seen_at: it.seenAt,
      product_type: classifyProductType(it.title),
      source: 'bestbuy',
      fetched_at: new Date(),
      expires_at: ttl(TTL_HOURS),
    });
    inserted++;
  }

  return { inserted };
}

