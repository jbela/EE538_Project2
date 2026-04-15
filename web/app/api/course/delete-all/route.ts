import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';
import { deleteLibraryItemById } from '@/lib/library-item-delete';

/** When true, delete all items with no course label (uncategorized). */
function isUncategorizedPayload(body: Record<string, unknown>): boolean {
  return body.uncategorized === true;
}

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

  const o = body as Record<string, unknown>;

  let rows: { id: string }[];

  if (isUncategorizedPayload(o)) {
    rows = await prisma.libraryItem.findMany({
      where: {
        OR: [{ courseLabel: null }, { courseLabel: '' }],
      },
      select: { id: true },
    });
  } else {
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!label) {
      return NextResponse.json(
        { error: 'Provide label for a named class, or { "uncategorized": true }' },
        { status: 400 }
      );
    }
    rows = await prisma.libraryItem.findMany({
      where: { courseLabel: label },
      select: { id: true },
    });
  }

  let deleted = 0;
  for (const { id } of rows) {
    const ok = await deleteLibraryItemById(id);
    if (ok) deleted += 1;
  }

  return NextResponse.json({ deleted });
}
