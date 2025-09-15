import { NextResponse } from "next/server";

function redirectHome() {
  const url = new URL('/', process.env.APP_BASE_URL ?? 'http://localhost:3000');
  const res = NextResponse.redirect(url);
  res.cookies.set('obr_session', '', { path: '/', maxAge: 0 });
  return res;
}

export async function POST() {
  return redirectHome();
}

export async function GET() {
  return redirectHome();
}
