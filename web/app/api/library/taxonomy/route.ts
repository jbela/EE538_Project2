import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLibraryAccess } from '@/lib/library-access';

/**
 * Distinct courses and per-course topics for extension / library UI pickers.
 */
export async function GET(request: Request) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.libraryItem.findMany({
    select: { courseLabel: true, topic: true },
  });

  const courseSet = new Set<string>();
  const topicsByCourse = new Map<string, Set<string>>();

  for (const row of rows) {
    const c = row.courseLabel?.trim();
    if (!c) continue;
    courseSet.add(c);
    if (!topicsByCourse.has(c)) topicsByCourse.set(c, new Set());
    const t = row.topic?.trim();
    if (t) topicsByCourse.get(c)!.add(t);
  }

  const courses = [...courseSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const topicsByCourseObj: Record<string, string[]> = {};
  for (const [c, set] of topicsByCourse) {
    topicsByCourseObj[c] = [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  return NextResponse.json({ courses, topicsByCourse: topicsByCourseObj });
}
