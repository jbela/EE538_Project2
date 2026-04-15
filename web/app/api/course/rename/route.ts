import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';

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
  const fromLabel = typeof o.fromLabel === 'string' ? o.fromLabel.trim() : '';
  const toLabel = typeof o.toLabel === 'string' ? o.toLabel.trim() : '';

  if (!fromLabel) {
    return NextResponse.json({ error: 'fromLabel is required' }, { status: 400 });
  }
  if (!toLabel) {
    return NextResponse.json({ error: 'toLabel is required' }, { status: 400 });
  }
  if (fromLabel === toLabel) {
    return NextResponse.json({ updated: 0 });
  }

  const result = await prisma.libraryItem.updateMany({
    where: { courseLabel: fromLabel },
    data: { courseLabel: toLabel },
  });

  return NextResponse.json({ updated: result.count });
}
