import { cookies } from 'next/headers';
import { verifySessionJWT } from './jwt';

export async function getSession() {
  const token = cookies().get('obx_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await verifySessionJWT(token);
    return payload as { sub: string; email: string };
  } catch {
    return null;
  }
}
