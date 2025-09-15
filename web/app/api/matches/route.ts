import { NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { inventory, stores, watches } from "@/lib/drizzle/schema";
import { and, desc, eq, ilike, inArray, lte, or, gte } from "drizzle-orm";
import { getSession } from "@/lib/utils/auth";

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ws = await db.select().from(watches).where(eq(watches.user_id, s.uid));

  const results: any[] = [];
  for (const w of ws) {
    const where = [
      eq(inventory.retailer, w.retailer as any),
      w.stores && w.stores.length ? inArray(inventory.store_id, w.stores) : undefined,
      w.sku ? eq(inventory.sku, w.sku) : undefined,
      !w.sku && w.keywords && w.keywords.length
        ? or(...w.keywords.map((k) => ilike(inventory.title, `%${k}%`)))
        : undefined,
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
        store_name: stores.name,
        store_city: stores.city,
        store_state: stores.state,
      })
      .from(inventory)
      .leftJoin(
        stores,
        and(eq(inventory.retailer, stores.retailer), eq(inventory.store_id, stores.store_id))
      )
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(inventory.seen_at), desc(inventory.id))
      .limit(5);

    for (const r of rows) {
      results.push({ watch_id: w.id, watch: { retailer: w.retailer, sku: w.sku, keywords: w.keywords }, item: r });
    }
  }

  // Sort combined list by seen_at desc and cap to 50
  results.sort((a, b) => new Date(b.item.seen_at).getTime() - new Date(a.item.seen_at).getTime());
  const matches = results.slice(0, 50);

  return NextResponse.json({ matches });
}

