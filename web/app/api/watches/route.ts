import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { watches } from "@/lib/drizzle/schema";
import { getSession } from "@/lib/utils/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const WatchInput = z.object({
  retailer: z.enum(["bestbuy","microcenter"]),
  sku: z.string().optional(),
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
  const rows = await db.select().from(watches).where(eq(watches.userId, s.uid));
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
  const w = await db.insert(watches).values({
    userId: s.uid,
    retailer: parsed.data.retailer,
    sku: parsed.data.sku,
    keywords: parsed.data.keywords,
    zipcode: parsed.data.zipcode,
    radiusMiles: parsed.data.radius_miles,
    stores: parsed.data.stores,
    priceCeilingCents: parsed.data.price_ceiling_cents,
    minCondition: parsed.data.min_condition,
  }).returning();
  return NextResponse.json({ watch: w[0] });
}
