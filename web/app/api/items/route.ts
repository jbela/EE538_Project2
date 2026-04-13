import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';

export async function GET(request: Request) {
  const ok = await verifyLibraryAccess(request);
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await prisma.libraryItem.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      summary: true,
      transcript: true,
      sourceUrl: true,
      courseLabel: true,
      topic: true,
      kind: true,
      createdAt: true,
      updatedAt: true,
      originalFileName: true,
      storedFileName: true,
    },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const ok = await verifyLibraryAccess(request);
  if (!ok) {
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
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const summary = typeof o.summary === 'string' ? o.summary : '';
  if (!title || !summary) {
    return NextResponse.json(
      { error: 'Fields "title" and "summary" are required' },
      { status: 400 }
    );
  }

  const transcript = typeof o.transcript === 'string' ? o.transcript : null;
  const sourceUrl = typeof o.sourceUrl === 'string' ? o.sourceUrl : null;
  const courseLabel = typeof o.courseLabel === 'string' ? o.courseLabel.trim() || null : null;
  const topic = typeof o.topic === 'string' ? o.topic.trim() || null : null;
  const kind = typeof o.kind === 'string' && o.kind.trim() ? o.kind.trim() : 'summary';

  const item = await prisma.libraryItem.create({
    data: {
      title,
      summary,
      transcript,
      sourceUrl,
      courseLabel,
      topic,
      kind,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      transcript: true,
      sourceUrl: true,
      courseLabel: true,
      topic: true,
      kind: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
