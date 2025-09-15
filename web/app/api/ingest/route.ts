import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { inventory } from '@/lib/drizzle/schema';
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

  const values = items.map((it) => ({
    retailer: it.retailer as any,
    store_id: it.storeId,
    sku: it.sku ?? null,
    title: it.title,
    condition_label: it.conditionLabel,
    condition_rank: normalizeRank(it.conditionLabel) as any,
    price_cents: it.priceCents,
    url: it.url,
    seen_at: it.seenAt ? new Date(it.seenAt) : new Date(),
  }));

  await db.insert(inventory).values(values);
  return NextResponse.json({ ok: true, inserted: values.length });
}

