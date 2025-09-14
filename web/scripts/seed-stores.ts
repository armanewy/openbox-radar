import 'dotenv/config';
import { db } from '@/lib/drizzle/db';
import { stores } from '@/lib/drizzle/schema';
import fs from 'node:fs';
import path from 'node:path';

type Row = { retailer: 'bestbuy'|'microcenter'; store_id: string; name: string; zipcode?: string; city?: string; state?: string; lat?: number; lng?: number };

async function run() {
  const root = path.resolve(process.cwd(), "..", "db", "seed");
  const files = ["stores.bestbuy.json", "stores.microcenter.json"];
  for (const f of files) {
    const rows: Row[] = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
    for (const r of rows) {
      await db.insert(stores).values({
        retailer: r.retailer, storeId: r.store_id, name: r.name,
        zipcode: r.zipcode || null, city: r.city || null, state: r.state || null,
        lat: r.lat as any, lng: r.lng as any,
      }).onConflictDoNothing();
    }
  }
  console.log("Seeded stores.");
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(1);});
