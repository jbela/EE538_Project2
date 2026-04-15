import { prisma } from '@/lib/prisma';
import { deleteStoredFileIfExists } from '@/lib/uploads';

/** Deletes one library row and its uploaded file on disk, if any. */
export async function deleteLibraryItemById(id: string): Promise<boolean> {
  const item = await prisma.libraryItem.findUnique({ where: { id } });
  if (!item) return false;
  await deleteStoredFileIfExists(item.storedFileName);
  await prisma.libraryItem.delete({ where: { id } });
  return true;
}
