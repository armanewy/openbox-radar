import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const rows = await db.execute(sql`
    SELECT source, channel, confidence, product_type, COUNT(*)::int AS count
    FROM inventory
    WHERE seen_at > NOW() - INTERVAL '36 hours'
    GROUP BY source, channel, confidence, product_type
    ORDER BY count DESC
  `);
  return NextResponse.json({ rows: rows.rows ?? [] });
}
