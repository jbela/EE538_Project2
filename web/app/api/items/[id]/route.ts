import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';
import { deleteLibraryItemById } from '@/lib/library-item-delete';

type Ctx = { params: Promise<{ id: string }> };

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
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
  const patch: { topic?: string | null; courseLabel?: string | null } = {};

  if ('topic' in o) patch.topic = trimOrNull(o.topic);
  if ('courseLabel' in o) patch.courseLabel = trimOrNull(o.courseLabel);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields: use topic and/or courseLabel' }, { status: 400 });
  }

  try {
    const item = await prisma.libraryItem.update({
      where: { id },
      data: patch,
      select: {
        id: true,
        title: true,
        topic: true,
        courseLabel: true,
      },
    });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const ok = await deleteLibraryItemById(id);
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
