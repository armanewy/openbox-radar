import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { stores } from "@/lib/drizzle/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { milesBetween } from "@/lib/geo/distance";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const retailer = url.searchParams.get("retailer");
  const state = url.searchParams.get("state");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const radius = url.searchParams.get("radius");

  // Nearby stores by lat/lng (retailer optional here)
  const hasGeo = lat && lng && radius;
  if (hasGeo) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const rad = Math.max(1, Math.min(500, Number(radius)));
    // Rough bounding box to reduce rows (~69 miles per degree latitude)
    const deg = rad / 69;
    const minLat = latNum - deg;
    const maxLat = latNum + deg;
    const minLng = lngNum - deg;
    const maxLng = lngNum + deg;
    const where: any[] = [
      isNotNull(stores.lat as any),
      isNotNull(stores.lng as any),
      sql`${stores.lat} BETWEEN ${minLat} AND ${maxLat}`,
      sql`${stores.lng} BETWEEN ${minLng} AND ${maxLng}`,
    ];
    if (retailer) where.push(eq(stores.retailer, retailer as any));
    const rows = await db
      .select({
        retailer: stores.retailer,
        store_id: stores.store_id,
        name: stores.name,
        city: stores.city,
        state: stores.state,
        zipcode: stores.zipcode,
        lat: stores.lat as any,
        lng: stores.lng as any,
      })
      .from(stores)
      .where(and(...where))
      .limit(500);

    const origin = { lat: latNum, lng: lngNum };
    const withDist = rows
      .map((r) => ({
        ...r,
        distance_miles: typeof r.lat === 'number' && typeof r.lng === 'number' ? milesBetween(origin, { lat: r.lat, lng: r.lng }) : null,
      }))
      .filter((r) => r.distance_miles != null && (r.distance_miles as number) <= rad)
      .sort((a, b) => (a.distance_miles! - b.distance_miles!))
      .slice(0, 50);
    return NextResponse.json({ stores: withDist, origin, radius: rad });
  }

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
