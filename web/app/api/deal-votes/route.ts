import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { deal_votes } from '@/lib/drizzle/schema';
import { and, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';

function ensureVoter(): string {
  const jar = cookies();
  let v = jar.get('obr_voter')?.value;
  if (!v) {
    v = crypto.randomUUID();
    // Set for ~1 year
    jar.set('obr_voter', v, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  }
  return v;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.inventory_id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const voter = ensureVoter();
  try {
    await db.insert(deal_votes).values({ inventory_id: id, voter_hash: voter }).onConflictDoNothing();
  } catch {}
  // return count in 24h window
  let c = 0;
  try {
    const rows = await db
      .select({ c: count() })
      .from(deal_votes)
      .where(and(eq(deal_votes.inventory_id, id as any), gt(deal_votes.created_at, sql`now() - interval '24 hours'`)));
    c = Number(rows?.[0]?.c || 0);
  } catch {}
  return NextResponse.json({ ok: true, votes_24h: c });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
  if (!ids.length) return NextResponse.json({ votes: {} });
  try {
    const rows = await db
      .select({ inventory_id: deal_votes.inventory_id, c: count() })
      .from(deal_votes)
      .where(and(inArray(deal_votes.inventory_id, ids as any), gt(deal_votes.created_at, sql`now() - interval '24 hours'`)))
      .groupBy(deal_votes.inventory_id)
      .orderBy(desc(count())) as any;
    const map: Record<number, number> = {};
    for (const r of rows) map[r.inventory_id] = Number(r.c || 0);
    return NextResponse.json({ votes: map });
  } catch {
    return NextResponse.json({ votes: {} });
  }
}

