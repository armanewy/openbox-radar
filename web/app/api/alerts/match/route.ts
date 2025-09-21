import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { inventory, stores, watches } from '@/lib/drizzle/schema';
import { and, desc, eq, ilike, inArray, lte, or, gte } from 'drizzle-orm';
import { lookupZip } from '@/lib/geo/zipdb';
import { milesBetween } from '@/lib/geo/distance';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ok = secret && auth === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const u = new URL(req.url);
  const watchId = u.searchParams.get('watch_id');
  const limit = Math.max(1, Math.min(50, Number(u.searchParams.get('limit') || 5)));
  if (!watchId) return NextResponse.json({ error: 'watch_id required' }, { status: 400 });

  const w = await db.query.watches.findFirst({ where: eq(watches.id, watchId as any) });
  if (!w) return NextResponse.json({ error: 'watch not found' }, { status: 404 });

  const storeIds = Array.isArray(w.stores)
    ? w.stores.map((id) => (typeof id === 'string' ? id.trim() : '')).filter((id) => id.length)
    : [];
  const keywords = Array.isArray(w.keywords)
    ? w.keywords.map((word) => (typeof word === 'string' ? word.trim() : '')).filter((word) => word.length)
    : [];
  const sku = typeof w.sku === 'string' ? w.sku.trim() : '';

  const where = [
    eq(inventory.retailer, w.retailer as any),
    storeIds.length ? inArray(inventory.store_id, storeIds) : undefined,
    sku ? ilike(inventory.sku, sku) : undefined,
    !sku && keywords.length ? or(...keywords.map((k) => ilike(inventory.title, `%${k}%`))) : undefined,
    w.price_ceiling_cents ? lte(inventory.price_cents, w.price_ceiling_cents) : undefined,
    w.min_condition ? gte(inventory.condition_rank as any, w.min_condition as any) : undefined,
  ].filter(Boolean) as any[];

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
      seen_at: inventory.seen_at,
      image_url: inventory.image_url,
      store_name: stores.name,
      store_city: stores.city,
      store_state: stores.state,
      store_zip: stores.zipcode,
      store_lat: stores.lat as any,
      store_lng: stores.lng as any,
    })
    .from(inventory)
    .leftJoin(stores, and(eq(stores.retailer, inventory.retailer), eq(stores.store_id, inventory.store_id)))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(inventory.seen_at), desc(inventory.id))
    .limit(200);

  const zipcode = typeof w.zipcode === 'string' ? w.zipcode.trim() : '';
  const radius = typeof w.radius_miles === 'number' ? w.radius_miles : Number(w.radius_miles || 0);

  let items = rows;
  if (zipcode && radius) {
    const origin = lookupZip(zipcode);
    if (origin) {
      items = rows.filter((r) => {
        let lat = typeof (r.store_lat as any) === 'number' ? (r.store_lat as any as number) : undefined;
        let lng = typeof (r.store_lng as any) === 'number' ? (r.store_lng as any as number) : undefined;
        if ((lat == null || lng == null) && r.store_zip) {
          const p = lookupZip(r.store_zip);
          if (p) { lat = p.lat; lng = p.lng; }
        }
        if (lat == null || lng == null) return false;
        const d = milesBetween(origin, { lat, lng });
        return d <= radius;
      });
    }
  }

  const result = items.slice(0, limit).map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    price_cents: r.price_cents,
    condition_label: r.condition_label,
    store: r.store_name || r.store_id,
    seen_at: r.seen_at,
  }));
  return NextResponse.json({ items: result });
}

