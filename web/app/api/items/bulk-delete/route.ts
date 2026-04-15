import { NextResponse } from 'next/server';
import { verifyLibraryAccess } from '@/lib/library-access';
import { deleteLibraryItemById } from '@/lib/library-item-delete';

const MAX_IDS = 200;

export async function POST(request: Request) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 });
  }

  const idsRaw = (body as { ids?: unknown }).ids;
  if (!Array.isArray(idsRaw)) {
    return NextResponse.json({ error: 'Field "ids" must be an array' }, { status: 400 });
  }

  const ids = [...new Set(idsRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0))];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No ids to delete' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `At most ${MAX_IDS} items per request` }, { status: 400 });
  }

  let deleted = 0;
  const failed: string[] = [];
  for (const id of ids) {
    try {
      const ok = await deleteLibraryItemById(id);
      if (ok) deleted += 1;
      else failed.push(id);
    } catch {
      failed.push(id);
    }
  }

  return NextResponse.json({ deleted, failedIds: failed });
}
