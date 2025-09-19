import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { alert_events, inventory, users, watches } from '@/lib/drizzle/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { sendAlertEmail } from '@/lib/alerts/email';

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ok = secret && auth === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const watchId = body?.watchId as string | undefined;
  const ids = (Array.isArray(body?.inventoryIds) ? body.inventoryIds : []).filter((n: any) => Number.isInteger(n));
  if (!watchId || !ids.length) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  let inserted = 0;
  try {
    for (const id of ids) {
      await db.insert(alert_events).values({ watch_id: watchId as any, inventory_id: id as any }).onConflictDoNothing();
      inserted++;
    }
  } catch {
    // If table missing, skip dedupe (best effort)
  }

  // Fetch email + one item and send a simple alert (batch behavior can be improved later)
  const w = await db.query.watches.findFirst({ where: eq(watches.id, watchId as any) });
  const u = w?.user_id ? await db.query.users.findFirst({ where: eq(users.id, w.user_id) }) : null;
  const email = u?.email || null;
  if (email) {
    const rows = await db.select().from(inventory).where(inArray(inventory.id, ids)).limit(1);
    const it = rows[0] as any;
    if (it) {
      try {
        await sendAlertEmail(email, {
          title: it.title,
          priceCents: it.price_cents,
          conditionLabel: it.condition_label,
          url: it.url,
          store: it.store_id,
          reason: 'new',
        });
      } catch (e) {
        console.warn('send email failed', e);
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, emailed: !!email });
}

