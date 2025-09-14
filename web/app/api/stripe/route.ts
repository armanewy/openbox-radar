import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: verify stripe signature and update subscription plan
  return NextResponse.json({ received: true });
}
