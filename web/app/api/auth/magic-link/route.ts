import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { users, magicTokens } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  _resend = new Resend(key);
  return _resend;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const existing = await db.select().from(users).where(eq(users.email, email));
    const user = existing[0] ?? (await db.insert(users).values({ email }).returning())[0];

    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(magicTokens).values({ email, userId: user.id, token, expiresAt });

    const link = `${process.env.APP_BASE_URL}/api/auth/callback?token=${token}`;

    const resend = getResend();
    await resend.emails.send({
      from: "Open-Box Radar <login@openboxradar.com>",
      to: email,
      subject: "Your sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
      // optional:
      // reply_to: "you@gmail.com",
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("magic-link error:", err); // view in Vercel logs
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
