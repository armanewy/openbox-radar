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
  try {
    const r = await db.execute(sql`select 1 as ok`);
    dbOk = r.rows?.[0]?.ok === 1;
  } catch (e: any) {
    dbError = e?.message ?? String(e);
    console.error('db health error:', e);
  }

  return NextResponse.json({ nodeExtra, hasSupabaseB64, files, db: { ok: dbOk, error: dbError } });
}
