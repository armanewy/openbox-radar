import 'dotenv/config';
import { db } from '../lib/drizzle/db';
import { stores } from '../lib/drizzle/schema';
import { eq, or, isNull } from 'drizzle-orm';

async function fetchZipLatLng(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const place = json?.places?.[0];
    if (!place) return null;
    const lat = Number(place['latitude']);
    const lng = Number(place['longitude']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function run() {
  // Find stores missing coords
  const rows = await db
    .select({ retailer: stores.retailer, store_id: stores.store_id, zipcode: stores.zipcode })
    .from(stores)
    .where(or(isNull(stores.lat as any), isNull(stores.lng as any)) as any);

  const byZip = new Map<string, Array<{ retailer: string; store_id: string }>>();
  for (const r of rows) {
    const z = (r.zipcode || '').trim();
    if (!z) continue;
    if (!byZip.has(z)) byZip.set(z, []);
    byZip.get(z)!.push({ retailer: r.retailer as any, store_id: r.store_id });
  }

  let updated = 0;
  for (const [zip, list] of byZip.entries()) {
    const p = await fetchZipLatLng(zip);
    if (!p) {
      console.warn('zip lookup failed', zip);
      continue;
    }
    for (const s of list) {
      await db
        .update(stores)
        .set({ lat: p.lat as any, lng: p.lng as any })
        .where(eq(stores.retailer, s.retailer as any) as any)
        .where(eq(stores.store_id, s.store_id));
      updated++;
    }
    console.log('updated', zip, p, 'stores:', list.length);
  }
  console.log('backfill complete. rows updated:', updated);
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

