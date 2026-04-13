import { prisma } from '@/lib/prisma';
import { buildClassNav } from '@/lib/library-org';
import { LibrarySidebarClient } from '@/components/library-sidebar-client';

export async function LibrarySidebar() {
  const [total, grouped] = await Promise.all([
    prisma.libraryItem.count(),
    prisma.libraryItem.groupBy({
      by: ['courseLabel'],
      _count: { id: true },
    }),
  ]);

  const classes = buildClassNav(grouped);
  return <LibrarySidebarClient total={total} classes={classes} />;
}
