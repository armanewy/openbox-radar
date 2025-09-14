import 'server-only';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

type Session = { uid: string; email: string };

export function getSession(): Session | null {
  const token = cookies().get('obr_session')?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as Session;
  } catch {
    return null;
  }
}
