'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'crypto';
import { LIBRARY_COOKIE_NAME, librarySessionCookieValue } from '@/lib/library-access';

export async function loginWithLibraryKey(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const submitted = String(formData.get('key') ?? '').trim();
  const envKey = process.env.LIBRARY_API_KEY ?? '';
  if (!envKey) {
    return 'Server missing LIBRARY_API_KEY. Copy web/.env.example to web/.env and set it.';
  }

  const a = Buffer.from(submitted, 'utf8');
  const b = Buffer.from(envKey, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return 'Invalid access key.';
  }

  const val = librarySessionCookieValue();
  if (!val) {
    return 'Server missing LIBRARY_COOKIE_SECRET. Set it in web/.env (see .env.example).';
  }

  const jar = await cookies();
  jar.set(LIBRARY_COOKIE_NAME, val, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/');
}

export async function logoutLibrary() {
  const jar = await cookies();
  jar.delete(LIBRARY_COOKIE_NAME);
  redirect('/');
}
