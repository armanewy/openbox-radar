import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { alerts, inventory, users, watches } from "@/lib/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { fetchDevItems } from "@/lib/retailers/dev";
import { sendAlertEmail } from "@/lib/alerts/email";

const DROP_MIN_CENTS = 2500;   // $25
const DROP_MIN_PCT = 5;        // 5%

export async function GET(req: NextRequest) {
  // Protect in prod
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.NODE_ENV === "production" && auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Pull active watches
  const ws = await db.select().from(watches).where(eq(watches.active, true));

  let checked = 0;
  for (const w of ws) {
    // DEV: stub items; later swap to real retailer adapters
    const items = await fetchDevItems({ retailer: w.retailer as any, sku: w.sku });
    for (const item of items) {
      checked++;

      // Find last snapshot for same key
      const last = await db.select().from(inventory)
        .where(and(
          eq(inventory.retailer, item.retailer as any),
          eq(inventory.storeId, item.storeId),
          eq(inventory.sku, item.sku || null)
        ))
        .orderBy(desc(inventory.seenAt)).limit(1);

      let reason: 'new' | 'price_drop' | null = null;
      if (!last.length) {
        reason = 'new';
      } else {
        const old = last[0].priceCents;
        const drop = old - item.priceCents;
        const pct = old ? (drop / old) * 100 : 0;
        if (drop >= DROP_MIN_CENTS || pct >= DROP_MIN_PCT) reason = 'price_drop';
      }
      if (!reason) continue;

      // Record snapshot
      const inserted = await db.insert(inventory).values({
        retailer: item.retailer as any,
        storeId: item.storeId,
        sku: item.sku || null,
        title: item.title,
        conditionLabel: item.conditionLabel,
        conditionRank: 'excellent',       // DEV mapping
        priceCents: item.priceCents,
        url: item.url,
        seenAt: new Date(item.seenAt),
      }).returning({ id: inventory.id });

      // Email the user
      const u = await db.select().from(users).where(eq(users.id, w.userId));
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

      await db.insert(alerts).values({
        watchId: w.id,
        inventoryId: inserted[0].id,
        channel: 'email',
        reason,
      });
    }
  }

  return NextResponse.json({ ok: true, checked });
}
