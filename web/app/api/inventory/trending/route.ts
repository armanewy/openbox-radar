import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { inventory, stores } from "@/lib/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "recent").toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 12)));
  const retailer = url.searchParams.get("retailer");

  if (type === "drops") {
    const rows = await db.execute(sql`
      with t as (
        select i.*, lag(i.price_cents) over (
          partition by i.retailer, i.store_id, coalesce(i.sku, i.url)
          order by i.seen_at
        ) as prev_price
        from ${inventory} as i
        where i.seen_at > now() - interval '7 days'
        ${retailer ? sql`and i.retailer = ${retailer}` : sql``}
      )
      select t.*, (t.prev_price - t.price_cents) as drop_cents,
             s.name as store_name, s.city as store_city, s.state as store_state, s.zipcode as store_zip
      from t
      left join ${stores} as s on s.retailer = t.retailer and s.store_id = t.store_id
      where t.prev_price is not null and t.prev_price > t.price_cents
      order by drop_cents desc, t.seen_at desc
      limit ${limit}
    `);

    const items = (rows.rows as any[]).map((r) => ({
      id: r.id,
      retailer: r.retailer,
      store_id: r.store_id,
      sku: r.sku,
      title: r.title,
      condition_label: r.condition_label,
      condition_rank: r.condition_rank,
      price_cents: r.price_cents,
      url: r.url,
      seen_at: r.seen_at,
      drop_cents: Number(r.drop_cents ?? 0),
      store: { name: r.store_name, city: r.store_city, state: r.store_state, zipcode: r.store_zip },
    }));
    return NextResponse.json({ items, type: "drops" });
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
      seen_at: inventory.seen_at,
      store_name: stores.name,
      store_city: stores.city,
      store_state: stores.state,
      store_zip: stores.zipcode,
    })
    .from(inventory)
    .leftJoin(
      stores,
      and(eq(inventory.retailer, stores.retailer), eq(inventory.store_id, stores.store_id))
    )
    .where(retailer ? eq(inventory.retailer, retailer as any) : undefined)
    .orderBy(desc(inventory.seen_at), desc(inventory.id))
    .limit(limit);

  const items = rows.map((r) => ({
    id: r.id,
    retailer: r.retailer,
    store_id: r.store_id,
    sku: r.sku,
    title: r.title,
    condition_label: r.condition_label,
    condition_rank: r.condition_rank,
    price_cents: r.price_cents,
    url: r.url,
    seen_at: r.seen_at,
    store: { name: r.store_name, city: r.store_city, state: r.store_state, zipcode: r.store_zip },
  }));
  return NextResponse.json({ items, type: "recent" });
}

