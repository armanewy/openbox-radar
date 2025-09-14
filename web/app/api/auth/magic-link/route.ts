import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  // TODO: generate one-time token and send via Postmark/Resend
  console.log("Magic link requested for", email);
  return NextResponse.json({ ok: true });
}
