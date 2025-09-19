import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Lightweight internal log; expand to DB or external later
    console.log('[analytics]', JSON.stringify({
      ip: req.headers.get('x-forwarded-for') || 'local',
      ua: req.headers.get('user-agent') || '',
      ...body,
    }));
  } catch {}
  return NextResponse.json({ ok: true });
}

