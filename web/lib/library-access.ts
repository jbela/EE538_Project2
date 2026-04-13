import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const LIBRARY_COOKIE_NAME = 'library_session';

/** HMAC stored in httpOnly cookie after successful key entry (not the raw API key). */
export function librarySessionCookieValue(): string | null {
  const key = process.env.LIBRARY_API_KEY;
  const secret = process.env.LIBRARY_COOKIE_SECRET;
  if (!key || !secret) return null;
  return createHmac('sha256', secret).update(key, 'utf8').digest('hex');
}

export function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function isLibraryBrowserSession(): Promise<boolean> {
  const expected = librarySessionCookieValue();
  if (!expected) return false;
  const jar = await cookies();
  return jar.get(LIBRARY_COOKIE_NAME)?.value === expected;
}

/** Extension: Bearer key. Browser: session cookie (same-origin requests). */
export async function verifyLibraryAccess(request: Request): Promise<boolean> {
  const envKey = process.env.LIBRARY_API_KEY;
  if (!envKey) return false;

  const authz = request.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) {
    const token = authz.slice(7).trim();
    return timingSafeEqualString(token, envKey);
  }

  const expected = librarySessionCookieValue();
  if (!expected) return false;
  const jar = await cookies();
  return jar.get(LIBRARY_COOKIE_NAME)?.value === expected;
}
