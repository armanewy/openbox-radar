import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { watches, users } from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ok = secret && auth === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Return active watches with user email
  const rows = await db
    .select({
      id: watches.id,
      user_id: watches.user_id,
      retailer: watches.retailer,
      sku: watches.sku,
      keywords: watches.keywords,
      zipcode: watches.zipcode,
      radius_miles: watches.radius_miles,
      stores: watches.stores,
      price_ceiling_cents: watches.price_ceiling_cents,
      min_condition: watches.min_condition,
      active: watches.active,
      created_at: watches.created_at,
      email: users.email,
    })
    .from(watches)
    .leftJoin(users, eq(users.id, watches.user_id))
    .where(eq(watches.active, true));

  return NextResponse.json({ watches: rows });
}

