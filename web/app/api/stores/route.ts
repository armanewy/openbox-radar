import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { stores } from "@/lib/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const retailer = url.searchParams.get("retailer");
  const state = url.searchParams.get("state");
  if (!retailer) return NextResponse.json({ error: "retailer required" }, { status: 400 });

  if (!state) {
    const rows = await db.execute(sql`
      select state, count(*) as count
      from stores
      where retailer = ${retailer}
      group by state
      order by state asc
    `);
    return NextResponse.json({
      states: (rows.rows as any[])
        .map((r) => ({ state: r.state as string | null, count: Number(r.count) }))
        .filter((r) => r.state && r.state.trim().length),
    });
  }

  const rows = await db
    .select({ store_id: stores.store_id, name: stores.name, city: stores.city, zipcode: stores.zipcode })
    .from(stores)
    .where(and(eq(stores.retailer, retailer as any), eq(stores.state, state)))
    .orderBy(stores.city, stores.name);
  return NextResponse.json({ stores: rows });
}

