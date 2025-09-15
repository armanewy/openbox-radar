import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signSessionJWT(payload: Record<string, unknown>, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(secret);
}

export async function verifySessionJWT(token: string) {
  return await jwtVerify(token, secret);
}
