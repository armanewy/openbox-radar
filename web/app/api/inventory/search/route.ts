import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { inventory, stores } from "@/lib/drizzle/schema";
import { and, desc, asc, eq, ilike, inArray, lte, gte, or, lt } from "drizzle-orm";
import { lookupZip } from "@/lib/geo/zipdb";
import { milesBetween } from "@/lib/geo/distance";

type Cursor = { seenAt: string; id: number };

function parseCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (obj && typeof obj.seenAt === "string" && typeof obj.id === "number") {
      return obj as Cursor;
    }
  } catch {}
  return null;
}

function encodeCursor(c: Cursor | null): string | null {
  if (!c) return null;
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

function parseMulti(param: string | null): string[] | null {
  if (!param) return null;
  // support repeated or comma-separated values
  const parts = param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const q = url.searchParams.get("q");
  const retailer = url.searchParams.get("retailer");
  const storeParam = url.searchParams.getAll("store_id").join(",") || url.searchParams.get("store_id");
  const storeIds = parseMulti(storeParam);
  const minCondition = url.searchParams.get("min_condition");
  const priceMinRaw = url.searchParams.get("price_min");
  const priceMaxRaw = url.searchParams.get("price_max");
  // Interpret price_min/max as USD and convert to cents if present
  const toCents = (v: string | null) => (v != null && v !== "" ? Math.round(Number(v) * 100) : null);
  const priceMin = toCents(priceMinRaw);
  const priceMax = toCents(priceMaxRaw);
  const skuFilter = url.searchParams.get("sku");
  const zip = url.searchParams.get("zip");
  const radiusMiles = url.searchParams.get("radius_miles");
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 50)));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const sort = url.searchParams.get("sort") || "relevance";

  const whereClauses = [
    retailer ? eq(inventory.retailer, retailer as any) : undefined,
    storeIds && storeIds.length ? inArray(inventory.store_id, storeIds) : undefined,
    q ? or(ilike(inventory.title, `%${q}%`), ilike(inventory.sku, `%${q}%`)) : undefined,
    skuFilter ? ilike(inventory.sku, `%${skuFilter}%`) : undefined,
    priceMin != null ? gte(inventory.price_cents, priceMin) : undefined,
    priceMax != null ? lte(inventory.price_cents, priceMax) : undefined,
    minCondition ? gte(inventory.condition_rank as any, minCondition as any) : undefined,
    // Cursor pagination: (seen_at, id) tuple less-than the cursor
    cursor
      ? or(
          lt(inventory.seen_at, new Date(cursor.seenAt)),
          and(eq(inventory.seen_at, new Date(cursor.seenAt)), lt(inventory.id, cursor.id))
        )
      : undefined,
  ].filter(Boolean) as any[];

  // NOTE on geo filter: requires ZIP->lat/lng lookup not present yet.
  // We still join stores to enrich results and enable client-side distance if desired.
  // TODO: once a ZIP geocoder table is added, compute distance and filter by radius.
  // sorting
  let order = [desc(inventory.seen_at), desc(inventory.id)];
  if (sort === "price_asc") order = [asc(inventory.price_cents), desc(inventory.seen_at), desc(inventory.id)];
  else if (sort === "price_desc") order = [desc(inventory.price_cents), desc(inventory.seen_at), desc(inventory.id)];
  else if (sort === "newest") order = [desc(inventory.seen_at), desc(inventory.id)];
  // discount_desc requires MSRP/baseline; fallback to relevance until data is available

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
      image_url: inventory.image_url,
      seen_at: inventory.seen_at,
      store_name: stores.name,
      store_city: stores.city,
      store_state: stores.state,
      store_zip: stores.zipcode,
      store_lat: stores.lat as any,
      store_lng: stores.lng as any,
    })
    .from(inventory)
    .leftJoin(
      stores,
      and(eq(inventory.retailer, stores.retailer), eq(inventory.store_id, stores.store_id))
    )
    .where(whereClauses.length ? and(...whereClauses) : undefined)
    .orderBy(...order)
    .limit(limit + 1);

  let nextCursor: string | null = null;
  let items = rows;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    items = rows.slice(0, limit);
    nextCursor = encodeCursor({ seenAt: last.seen_at.toISOString(), id: last.id });
  }

  // Server-side distance filtering using ZIP centroid
  let origin: { lat: number; lng: number } | null = null;
  const radius = radiusMiles ? Number(radiusMiles) : NaN;
  if (zip && radius && !Number.isNaN(radius)) {
    origin = lookupZip(zip);
  }
  let geoMeta: any = undefined;
  if (origin && radius > 0) {
    const filtered: typeof items = [] as any;
    for (const r of items) {
      let slat = typeof r.store_lat === 'number' ? r.store_lat : null;
      let slng = typeof r.store_lng === 'number' ? r.store_lng : null;
      if ((slat == null || slng == null) && r.store_zip) {
        const p = lookupZip(r.store_zip);
        if (p) {
          slat = p.lat;
          slng = p.lng;
        }
      }
      if (slat == null || slng == null) {
        continue; // cannot compute distance reliably → exclude
      }
      const d = milesBetween(origin, { lat: slat, lng: slng });
      if (d <= radius) {
        (r as any)._distance_miles = d;
        filtered.push(r);
      }
    }
    items = filtered;
    geoMeta = { zip, radiusMiles: String(radius), supported: true, count: items.length };
  } else if (zip || radiusMiles) {
    geoMeta = { zip, radiusMiles, supported: false };
  }

  return NextResponse.json({
    items: items.map((r) => ({
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
      image_url: r.image_url,
      distance_miles: (r as any)._distance_miles,
      store: {
        name: r.store_name,
        city: r.store_city,
        state: r.store_state,
        zipcode: r.store_zip,
      },
    })),
    nextCursor,
    geo: geoMeta,
  });
}
