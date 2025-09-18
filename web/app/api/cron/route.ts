import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { inventory, users, watches } from "@/lib/drizzle/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { fetchDevItems } from "@/lib/retailers/dev";
import { sendAlertEmail } from "@/lib/alerts/email";
import { ingestBestBuyForSkus } from "@/lib/retailers/bestbuy/ingest";

const DROP_MIN_CENTS = 2500;   // $25
const DROP_MIN_PCT = 5;        // 5%

export async function GET(req: NextRequest) {
  // Protect in prod
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && secret && auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Pull active watches
  const ws = await db.select().from(watches).where(eq(watches.active, true));

  // Purge expired Best Buy rows (TTL ≤72h; we use 71h)
  await db.delete(inventory).where(and(eq(inventory.source, 'bestbuy' as any), lt(inventory.expires_at, new Date())));

  let checked = 0;
  for (const w of ws) {
    // DEV: stub items; later swap to real retailer adapters
    const items = await fetchDevItems({ retailer: w.retailer as any, sku: w.sku });
    for (const item of items) {
      checked++;

      // Find last snapshot for same key
      const last = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.retailer, item.retailer as any),
            eq(inventory.store_id, item.storeId),
            item.sku ? eq(inventory.sku, item.sku) : undefined
          )
        )
        .orderBy(desc(inventory.seen_at))
        .limit(1);

      let reason: 'new' | 'price_drop' | null = null;
      if (!last.length) {
        reason = 'new';
      } else {
        const old = last[0].price_cents;
        const drop = old - item.priceCents;
        const pct = old ? (drop / old) * 100 : 0;
        if (drop >= DROP_MIN_CENTS || pct >= DROP_MIN_PCT) {
          reason = 'price_drop';
        }
      }
      
      // Always insert a snapshot so the feed has data
      const rank = normalizeRank(item.conditionLabel);
      await db.insert(inventory).values({
        retailer: item.retailer as any,
        store_id: item.storeId,
        sku: item.sku ?? null,
        title: item.title,
        condition_label: item.conditionLabel,
        condition_rank: rank as any,
        price_cents: item.priceCents,
        url: item.url,
        seen_at: new Date(item.seenAt),
      });

      // Email only on 'new' or 'price_drop'
      if (reason && w.user_id) {
        const u = await db.select().from(users).where(eq(users.id, w.user_id));
        if (u[0]?.email) {
          await sendAlertEmail(u[0].email, {
            title: item.title,
            priceCents: item.priceCents,
            conditionLabel: item.conditionLabel,
            url: item.url,
            store: item.storeId,
            reason,
          });
        }
      }

      // TODO: alerts table not implemented in schema
    }
  }

  // Fetch Best Buy via API for watched SKUs (guarded by flag)
  if (process.env.BESTBUY_ENABLED === '1') {
    const bbySkus = ws.filter(w => (w.retailer as any) === 'bestbuy' && !!w.sku).map(w => w.sku!) as string[];
    if (bbySkus.length) {
      const { inserted } = await ingestBestBuyForSkus(bbySkus);
      console.log(`[cron] bestbuy inserted: ${inserted} rows for ${bbySkus.length} skus`);
    }
  }

  return NextResponse.json({ ok: true, checked });
}

function normalizeRank(label: string): 'certified'|'excellent'|'satisfactory'|'fair'|'unknown' {
  const s = label.toLowerCase();
  if (s.includes('certified')) return 'certified';
  if (s.includes('excellent')) return 'excellent';
  if (s.includes('satisfactory')) return 'satisfactory';
  if (s.includes('fair')) return 'fair';
  return 'unknown';
}
