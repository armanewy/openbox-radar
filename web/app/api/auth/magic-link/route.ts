import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { users, magicTokens } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  // upsert user
  const existing = await db.select().from(users).where(eq(users.email, email));
  const user = existing[0] ?? (await db.insert(users).values({ email }).returning())[0];

  // create token valid for 15 min
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(magicTokens).values({ email, userId: user.id, token, expiresAt });

  const link = `${process.env.APP_BASE_URL}/api/auth/callback?token=${token}`;

  await resend.emails.send({
    from: "Open-Box Radar <login@openboxradar.com>",
    to: email,
    replyTo: "aozturk6@gmail.com",
    subject: "Your sign-in link",
    html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
  });

  return NextResponse.json({ ok: true });
}
