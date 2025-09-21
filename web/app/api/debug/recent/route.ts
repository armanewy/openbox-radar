import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { inventory } from '@/lib/drizzle/schema';
import { and, desc, eq, gt } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
  const productType = url.searchParams.get('product_type');
  const cutoff = new Date(Date.now() - 36 * 60 * 60 * 1000);

  const where = [gt(inventory.seen_at, cutoff)];
  if (productType) {
    where.push(eq(inventory.product_type, productType as any));
  }

  const rows = await db
    .select({
      id: inventory.id,
      retailer: inventory.retailer,
      store_id: inventory.store_id,
      sku: inventory.sku,
      title: inventory.title,
      condition_label: inventory.condition_label,
      condition_rank: inventory.condition_rank,
      price_cents: inventory.price_cents,
      url: inventory.url,
      image_url: inventory.image_url,
      seen_at: inventory.seen_at,
      product_type: inventory.product_type,
      channel: inventory.channel,
      confidence: inventory.confidence,
    })
    .from(inventory)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(inventory.seen_at), desc(inventory.id))
    .limit(limit);

  return NextResponse.json({ items: rows });
}
