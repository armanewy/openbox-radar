import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Require the Authorization header in production. Vercel will send "Bearer <CRON_SECRET>"
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.NODE_ENV === "production" && auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // TODO: read active watches, call adapters, diff, send alerts
  return NextResponse.json({ ok: true, checked: 0 });
}
