import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { bb_store_availability } from '@/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';

function minutesSince(date: Date | null | undefined) {
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 60000;
}

function ttlConfig() {
  return {
    ttl: Number(process.env.BESTBUY_ENRICHMENT_TTL_MIN ?? 30),
    failTtl: Number(process.env.BESTBUY_ENRICHMENT_FAIL_TTL_MIN ?? 10),
  };
}

async function getCache(sku: string, zip: string) {
  try {
    return await db.query.bb_store_availability.findFirst({
      where: and(eq(bb_store_availability.sku, sku), eq(bb_store_availability.zip, zip)),
    });
  } catch (err: any) {
    const code = err?.code || err?.cause?.code;
    if (code === '42P01') {
      console.warn('[bb availability] cache table missing: run migration 0028_bb_store_availability.sql');
      return null;
    }
    throw err;
  }
}

async function triggerEnrichment(sku: string, zip: string) {
  const workerUrl = process.env.BESTBUY_ENRICH_WORKER_URL;
  if (!workerUrl) return false;
  try {
    const secret = process.env.CRON_SECRET;
    await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-cron-secret': secret } : {}),
      },
      body: JSON.stringify({ sku, zip }),
    });
    return true;
  } catch (err) {
    console.warn('[bb availability] enrichment trigger failed', err);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sku = url.searchParams.get('sku');
  const zip = url.searchParams.get('zip');
  if (!sku || !zip) {
    return NextResponse.json({ error: 'sku and zip required' }, { status: 400 });
  }

  const { ttl, failTtl } = ttlConfig();
  const row = await getCache(sku, zip);
  const age = minutesSince(row?.refreshed_at);
  const isFresh = row && !row.failed && age < ttl;
  const failFresh = row && row.failed && age < failTtl;

  const enrichmentEnabled = process.env.BESTBUY_ENRICHMENT_ENABLED === '1';
  let queued = false;
  if (enrichmentEnabled && !(isFresh || failFresh)) {
    queued = await triggerEnrichment(sku, zip);
  }

  return NextResponse.json({
    sku,
    zip,
    refreshed_at: row?.refreshed_at?.toISOString?.() ?? null,
    failed: row?.failed ?? false,
    stores: row?.stores ?? [],
    cache_age_min: Number.isFinite(age) ? age : null,
    stale: !(isFresh || failFresh),
    queued,
  });
}
