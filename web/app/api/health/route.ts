import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/drizzle/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const nodeExtra = process.env.NODE_EXTRA_CA_CERTS ?? null;
  const hasSupabaseB64 = !!process.env.SUPABASE_CA_B64;

  const possiblePaths = [
    nodeExtra,
    path.resolve(process.cwd(), 'supabase-ca.crt'),
    '/vercel/path0/supabase-ca.crt',
    '/tmp/supabase-ca.crt',
  ]
    .filter(Boolean) as string[];

  const files: Record<string, boolean> = {};
  for (const p of possiblePaths) {
    try {
      files[p] = fs.existsSync(p);
    } catch (e) {
      files[p] = false;
    }
  }

  // DB check
  let dbOk = false;
  let dbError: string | null = null;
  let latestSeenAt: string | null = null;
  let inventoryCount: number | null = null;
  let hasPriceHistory = false;
  let hasStoreCoords = false;
  try {
    const r = await db.execute(sql`select 1 as ok`);
    dbOk = r.rows?.[0]?.ok === 1;
    // latest inventory timestamp
    const latest = await db.execute(sql`select max(seen_at) as seen from public.inventory`);
    latestSeenAt = latest?.rows?.[0]?.seen ? new Date(latest.rows[0].seen as any).toISOString() : null;
    const cnt = await db.execute(sql`select count(*)::int as c from public.inventory`);
    inventoryCount = cnt?.rows?.[0]?.c ?? null;
    // table/column presence checks
    const ph = await db.execute(sql`select to_regclass('public.price_history') as t`);
    hasPriceHistory = !!ph?.rows?.[0]?.t;
    const col = await db.execute(sql`
      select exists(
        select 1 from information_schema.columns 
        where table_schema='public' and table_name='stores' and column_name in ('lat','lng')
      ) as ok
    `);
    hasStoreCoords = !!col?.rows?.[0]?.ok;
  } catch (e: any) {
    dbError = e?.message ?? String(e);
    console.error('db health error:', e);
  }

  return NextResponse.json({ nodeExtra, hasSupabaseB64, files, db: { ok: dbOk, error: dbError, latestSeenAt, inventoryCount, hasPriceHistory, hasStoreCoords } });
}
