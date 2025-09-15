import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/drizzle/db';
import { users, magicTokens } from '@/lib/drizzle/schema';
import { and, eq, gt, desc } from 'drizzle-orm';
import { Resend } from 'resend';
import { generateToken, normalizeEmail, tokenExpiry, isValidEmail } from '@/lib/auth/tokens';

export const runtime = 'nodejs'; // explicit: serverless functions

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const { email: rawEmail, next } = await req.json().catch(() => ({}));
    const email = typeof rawEmail === 'string' ? normalizeEmail(rawEmail) : '';

    // Always 200 for anti-enumeration, even if validation fails
    if (!isValidEmail(email)) return NextResponse.json({ ok: true });

    // Throttle: 60s between sends for same email if previous token is still valid
    const nowMinus60 = new Date(Date.now() - 60_000);
    const recent = await db.query.magicTokens.findFirst({
      where: and(
        eq(magicTokens.email, email),
        eq(magicTokens.used, false),
        gt(magicTokens.createdAt, nowMinus60)
      ),
      orderBy: [desc(magicTokens.createdAt)],
      columns: { id: true },
    });
    if (recent) {
      return NextResponse.json({ ok: true }); // silently accept
    }

    // Find-or-create user
    let user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      const [created] = await db.insert(users).values({ email }).returning();
      user = created!;
    }

    // Create token
    const token = generateToken();
    const expiresAt = tokenExpiry(15);
    await db.insert(magicTokens).values({
      userId: user.id,
      email,
      token,
      expiresAt,
    });

    // Build link (restrict next= to same-origin paths)
    const url = new URL('/api/auth/verify', APP_BASE_URL);
    url.searchParams.set('token', token);
    if (typeof next === 'string' && next.startsWith('/')) url.searchParams.set('next', next);

    // Email or log
    if (resend) {
      await resend.emails.send({
        from: 'Openbox Radar <auth@openboxradar.com>', // must be verified in Resend
        to: email,
        subject: 'Your sign-in link',
        html: `
          <p>Click to sign in (valid for 15 minutes):</p>
          <p><a href="${url.toString()}">${url.toString()}</a></p>
          <p>If you didn’t request this, you can ignore this email.</p>
        `,
      });
    } else {
      console.warn('[magic-link] RESEND_API_KEY not set; link:', url.toString());
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[magic-link] error', err);
    // still do not leak details
    return NextResponse.json({ ok: true });
  }
}
