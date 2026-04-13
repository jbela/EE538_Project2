import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';
import { getUploadsDir, mimeForStoredFile } from '@/lib/uploads';

type Ctx = { params: Promise<{ id: string }> };

function asciiFilename(name: string) {
  return name.replace(/[^\x20-\x7E]/g, '_') || 'download';
}

export async function GET(request: Request, ctx: Ctx) {
  if (!(await verifyLibraryAccess(request))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await ctx.params;
  const item = await prisma.libraryItem.findUnique({ where: { id } });
  if (!item?.storedFileName) {
    return new Response('Not found', { status: 404 });
  }

  const filePath = path.join(getUploadsDir(), item.storedFileName);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new Response('File missing', { status: 410 });
  }

  const mime = item.mimeType || mimeForStoredFile(item.originalFileName || '', null);
  const downloadName = asciiFilename(item.originalFileName || 'file');

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
