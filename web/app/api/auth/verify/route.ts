import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/drizzle/db';
import { users, magicTokens } from '@/lib/drizzle/schema';
import { and, eq, gt } from 'drizzle-orm';
import { signSessionJWT } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';
    const next = url.searchParams.get('next');

    if (!token) return redirectWithMessage('/', 'Invalid link');

    // find valid, unused token
    const now = new Date();
    const row = await db.query.magicTokens.findFirst({
      where: and(
        eq(magicTokens.token, token),
        eq(magicTokens.used, false),
        gt(magicTokens.expiresAt, now)
      ),
    });

    if (!row) return redirectWithMessage('/', 'Link expired or already used');

    // fetch user
    const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user) return redirectWithMessage('/', 'User not found');

    // mark token as used (best-effort)
    await db.update(magicTokens)
      .set({ used: true })
      .where(eq(magicTokens.id, row.id));

    // create session JWT
    const session = await signSessionJWT({ sub: user.id, email: user.email });

    // set cookie
    cookies().set('obx_session', session, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    const dest = typeof next === 'string' && next.startsWith('/') ? next : '/';
    return NextResponse.redirect(new URL(dest, process.env.APP_BASE_URL ?? 'http://localhost:3000'));
  } catch (err) {
    console.error('[verify] error', err);
    return redirectWithMessage('/', 'Sign-in failed');
  }
}

function redirectWithMessage(path: string, _msg: string) {
  // TODO: stash a flash message somewhere if you have a UI hook for it
  return NextResponse.redirect(new URL(path, process.env.APP_BASE_URL ?? 'http://localhost:3000'));
}
