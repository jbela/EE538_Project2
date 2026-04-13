import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';
import { KIND_FILE_UPLOAD } from '@/lib/material-kinds';
import {
  deleteStoredFileIfExists,
  mimeForStoredFile,
  sanitizeOriginalName,
  writeUploadBuffer,
} from '@/lib/uploads';

export async function POST(request: Request) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose a non-empty file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let storedFileName: string;
  try {
    ({ storedFileName } = await writeUploadBuffer(file.name, buffer));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const titleRaw = String(form.get('title') ?? '').trim();
  const title = titleRaw || sanitizeOriginalName(file.name).replace(/\.[^.]+$/, '') || file.name;
  const courseLabel = String(form.get('courseLabel') ?? '').trim() || null;
  const topic = String(form.get('topic') ?? '').trim() || null;
  const safeName = sanitizeOriginalName(file.name);

  let item;
  try {
    item = await prisma.libraryItem.create({
      data: {
        title,
        summary: `Uploaded file · ${safeName}`,
        kind: KIND_FILE_UPLOAD,
        courseLabel,
        topic,
        originalFileName: file.name,
        storedFileName,
        mimeType: mimeForStoredFile(file.name, file.type),
        fileSize: buffer.length,
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
  } catch {
    await deleteStoredFileIfExists(storedFileName);
    return NextResponse.json({ error: 'Could not save metadata' }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
