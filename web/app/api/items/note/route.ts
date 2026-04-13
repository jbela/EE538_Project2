import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';
import { KIND_TEXT_NOTE } from '@/lib/material-kinds';

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
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const noteContent = typeof o.noteContent === 'string' ? o.noteContent : '';
  if (!title || !noteContent.trim()) {
    return NextResponse.json({ error: 'title and noteContent are required' }, { status: 400 });
  }

  const courseLabel = typeof o.courseLabel === 'string' ? o.courseLabel.trim() || null : null;
  const topic = typeof o.topic === 'string' ? o.topic.trim() || null : null;

  const excerpt =
    noteContent.trim().length > 320 ? `${noteContent.trim().slice(0, 320)}…` : noteContent.trim();

  const item = await prisma.libraryItem.create({
    data: {
      title,
      summary: excerpt,
      kind: KIND_TEXT_NOTE,
      noteContent: noteContent.trim(),
      courseLabel,
      topic,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      kind: true,
      courseLabel: true,
      topic: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
