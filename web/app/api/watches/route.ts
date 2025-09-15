import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { watches } from "@/lib/drizzle/schema";
import { getSession } from "@/lib/utils/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const WatchInput = z.object({
  retailer: z.enum(["bestbuy","microcenter"]),
  sku: z.string().optional(),
  product_url: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  zipcode: z.string().min(3).max(10),
  radius_miles: z.number().int().min(1).max(200).default(25),
  stores: z.array(z.string()).optional(),
  price_ceiling_cents: z.number().int().positive().optional(),
  min_condition: z.enum(["certified","excellent","satisfactory","fair","unknown"]).default("fair"),
});

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db.select().from(watches).where(eq(watches.user_id, s.uid));
  return NextResponse.json({ watches: rows });
}

export async function POST(req: NextRequest) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = WatchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // If url provided but no sku, try parsing to infer sku
  let sku = parsed.data.sku ?? undefined;
  if (!sku && parsed.data.product_url) {
    try {
      const { parseProductUrl } = await import("@/lib/utils/parse");
      const info = parseProductUrl(parsed.data.product_url);
      if (info?.sku) sku = info.sku;
    } catch {}
  }
  const w = await db.insert(watches).values({
    user_id: s.uid,
    retailer: parsed.data.retailer as any,
    sku: sku ?? null,
    product_url: parsed.data.product_url ?? null,
    keywords: parsed.data.keywords ?? null,                                  // [] | null
    zipcode: parsed.data.zipcode ?? null,
    radius_miles: (parsed.data.radius_miles ?? parsed.data.radius_miles) ?? null,
    stores: parsed.data.stores ?? null,                                      // [] | null
    price_ceiling_cents:
      (parsed.data.price_ceiling_cents ?? parsed.data.price_ceiling_cents) ?? null,
    min_condition: (parsed.data.min_condition ?? parsed.data.min_condition) as any,
    active: true, // REQUIRED (DB says NOT NULL, no default)
  }).returning();

  return NextResponse.json({ watch: w[0] });
}
