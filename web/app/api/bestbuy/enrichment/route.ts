import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { bb_store_availability } from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const bodySchema = z.object({
  sku: z.string().min(1),
  zip: z.string().min(3),
  stores: z.array(z.any()),
  failed: z.boolean().optional(),
});

function minutesSince(date: Date) {
  return (Date.now() - date.getTime()) / 60000;
}

function ttlConfig() {
  const ttl = Number(process.env.BESTBUY_ENRICHMENT_TTL_MIN ?? 30);
  const failTtl = Number(process.env.BESTBUY_ENRICHMENT_FAIL_TTL_MIN ?? 10);
  return { ttl, failTtl };
}

function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev fallback
  const auth = req.headers.get('authorization') || '';
  const header = req.headers.get('x-cron-secret') || '';
  return auth === `Bearer ${secret}` || header === secret;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const sku = url.searchParams.get('sku');
  const zip = url.searchParams.get('zip');
  if (!sku || !zip) return NextResponse.json({ error: 'sku and zip required' }, { status: 400 });
  const { ttl, failTtl } = ttlConfig();

  const row = await db.query.bb_store_availability.findFirst({
    where: and(eq(bb_store_availability.sku, sku), eq(bb_store_availability.zip, zip)),
  });

  if (!row) return NextResponse.json({ cache: null, fresh: false, ttl, failTtl });

  const refreshedAt = row.refreshed_at;
  const age = refreshedAt ? minutesSince(refreshedAt) : Infinity;
  const isFresh = !row.failed && age < ttl;
  const isFailFresh = row.failed && age < failTtl;

  return NextResponse.json({
    cache: {
      sku: row.sku,
      zip: row.zip,
      stores: row.stores,
      refreshed_at: refreshedAt,
      failed: row.failed,
    },
    fresh: isFresh,
    failFresh: isFailFresh,
    ttl,
    failTtl,
  });
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sku, zip, stores, failed } = parsed.data;
  const payloadStores = stores as Record<string, unknown>[];
  const now = new Date();

  await db
    .insert(bb_store_availability)
    .values({
      sku,
      zip,
      stores: payloadStores,
      refreshed_at: now,
      failed: failed ?? false,
    })
    .onConflictDoUpdate({
      target: [bb_store_availability.sku, bb_store_availability.zip],
      set: {
        stores: payloadStores,
        refreshed_at: now,
        failed: failed ?? false,
      },
    });

  return NextResponse.json({ ok: true, refreshed_at: now.toISOString(), failed: failed ?? false });
}
