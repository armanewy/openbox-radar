import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // TODO: read active watches, group by retailer, call adapters, diff, alert
  return NextResponse.json({ ok: true, checked: 0 });
}
