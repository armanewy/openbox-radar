import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { inventory } from "@/lib/drizzle/schema";
import { and, desc, eq, ilike } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const retailer = url.searchParams.get("retailer");
  const sku = url.searchParams.get("sku");
  const productUrl = url.searchParams.get("url");
  const storeId = url.searchParams.get("store_id");
  const limit = Math.max(2, Math.min(50, Number(url.searchParams.get("limit") ?? 7)));

  if (!retailer) return NextResponse.json({ error: "retailer required" }, { status: 400 });
  if (!sku && !productUrl) return NextResponse.json({ error: "sku or url required" }, { status: 400 });

  const clauses = [
    eq(inventory.retailer, retailer as any),
    storeId ? eq(inventory.store_id, storeId) : undefined,
    sku ? ilike(inventory.sku, sku) : undefined,
    productUrl ? ilike(inventory.url, productUrl) : undefined,
  ].filter(Boolean) as any[];

  const rows = await db
    .select({ price_cents: inventory.price_cents, seen_at: inventory.seen_at })
    .from(inventory)
    .where(and(...clauses))
    .orderBy(desc(inventory.seen_at))
    .limit(limit);

  const points = rows
    .reverse()
    .map((r) => ({ t: r.seen_at.toISOString(), p: r.price_cents }));

  return NextResponse.json({ points });
}

