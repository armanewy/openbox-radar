import 'dotenv/config';
import { db } from '../lib/drizzle/db';            // ← relative, not "@/..."
import { stores } from '../lib/drizzle/schema';    // ← relative, not "@/..."
import fs from 'node:fs';
import path from 'node:path';

type Row = {
  retailer: 'bestbuy' | 'microcenter';
  store_id: string;
  name: string;
  zipcode?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
};

async function run() {
  // pick web/db/seed or ../db/seed (works locally & in monorepo)
  const roots = [
    path.resolve(process.cwd(), 'db', 'seed'),
    path.resolve(process.cwd(), '..', 'db', 'seed'),
  ];
  const root = roots.find((p) => fs.existsSync(p)) ?? roots[0];

  const files = ['stores.bestbuy.json', 'stores.microcenter.json'];
  for (const f of files) {
    const rows: Row[] = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
    for (const r of rows) {
      await db
        .insert(stores)
        .values({
          retailer: r.retailer as any,      // retailer_t UDT
          store_id: r.store_id,             // ← snake_case to match schema
          name: r.name,
          zipcode: r.zipcode ?? null,
          city: r.city ?? null,
          state: r.state ?? null,
          lat: r.lat ?? null,
          lng: r.lng ?? null,
        })
        .onConflictDoNothing(); // requires a unique/PK (e.g., (retailer, store_id))
    }
  }
  console.log('Seeded stores.');
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
