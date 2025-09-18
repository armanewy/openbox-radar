import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { inventory } from '@/lib/drizzle/schema';
import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';

const Item = z.object({
  retailer: z.enum(['bestbuy','microcenter']),
  storeId: z.string().min(1),
  sku: z.string().optional(),
  title: z.string().min(1),
  conditionLabel: z.string().min(1),
  priceCents: z.number().int().positive(),
  url: z.string().url(),
  seenAt: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
});

const Payload = z.object({ items: z.array(Item).max(1000) });

function normalizeRank(label: string): 'certified'|'excellent'|'satisfactory'|'fair'|'unknown' {
  const s = label.toLowerCase();
  if (s.includes('certified')) return 'certified';
  if (s.includes('excellent')) return 'excellent';
  if (s.includes('satisfactory')) return 'satisfactory';
  if (s.includes('fair')) return 'fair';
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const x = req.headers.get('x-cron-secret') || '';
  const okAuth = secret ? (auth === `Bearer ${secret}` || x === secret) : process.env.NODE_ENV !== 'production';
  if (!okAuth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = Payload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const items = parsed.data.items;
  if (items.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const dedupeMinutes = Number(process.env.INGEST_DEDUPE_MIN || 60);
  const threshold = new Date(Date.now() - dedupeMinutes * 60_000);

  let inserted = 0;
  for (const it of items) {
    const seenAt = it.seenAt ? new Date(it.seenAt) : new Date();
    // Skip if identical snapshot exists within dedupe window: same retailer, store, sku or url key, same price
    const exists = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(
        and(
          eq(inventory.retailer, it.retailer as any),
          eq(inventory.store_id, it.storeId),
          it.sku ? eq(inventory.sku, it.sku) : eq(inventory.url, it.url),
          eq(inventory.price_cents, it.priceCents),
          gt(inventory.seen_at, threshold)
        )
      )
      .limit(1);
    if (exists.length) continue;

    await db.insert(inventory).values({
      retailer: it.retailer as any,
      store_id: it.storeId,
      sku: it.sku ?? null,
      title: it.title,
      condition_label: it.conditionLabel,
      condition_rank: normalizeRank(it.conditionLabel) as any,
      price_cents: it.priceCents,
      url: it.url,
      seen_at: seenAt,
      image_url: it.imageUrl ?? null,
    }).onConflictDoNothing();
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}
