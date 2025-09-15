import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { users, magicTokens } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";

function makeResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}
const resend = makeResend();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    // upsert user
    const existing = await db.select().from(users).where(eq(users.email, email));
    const user = existing[0] ?? (await db.insert(users).values({ email }).returning())[0];

    // create token
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(magicTokens).values({ email, userId: user.id, token, expiresAt });

    const link = `${process.env.APP_BASE_URL}/api/auth/callback?token=${token}`;

    if (!resend) {
      console.warn("RESEND_API_KEY missing; not sending email. Link:", link);
      // TEMP: return the link so you can click through while we finish email setup
      return NextResponse.json({ ok: true, debug_link: link });
    }

    const result = await resend.emails.send({
      from: "Open-Box Radar <login@openboxradar.com>",
      to: email,
      subject: "Your sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
      // reply_to: "you@gmail.com", // optional
    });

    if ((result as any).error) {
      console.error("Resend send error:", (result as any).error);
      // TEMP: still return the link so you can sign in
      return NextResponse.json({ ok: false, debug_link: link }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("magic-link error:", err);
    // TEMP: expose the message to help diagnose quickly
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
