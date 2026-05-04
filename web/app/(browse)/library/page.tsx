import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { isLibraryBrowserSession } from '@/lib/library-access';
import {
  decodeCourseParam,
  encodeCourseParam,
  filterByCourse,
  filterByTopic,
  groupItemsByTopic,
  parseSortMode,
  sortItems,
  type LibraryListItem,
} from '@/lib/library-org';
import { LibraryBulkProvider } from '@/components/library-bulk-selection-context';
import { LibraryGroupedList } from '@/components/library-grouped-list';
import { LibraryToolbar } from '@/components/library-toolbar';
import { LibraryTopicPills } from '@/components/library-topic-pills';

type Props = {
  searchParams: Promise<{ course?: string; topic?: string; sort?: string }>;
};

export default async function LibraryPage({ searchParams }: Props) {
  if (!(await isLibraryBrowserSession())) redirect('/login');

  const sp = await searchParams;
  const courseRaw = sp.course ?? null;
  const topicRaw = sp.topic?.trim() || null;
  const sortMode = parseSortMode(sp.sort);
  const courseDecoded = decodeCourseParam(courseRaw ?? undefined);

  const rows = await prisma.libraryItem.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      summary: true,
      courseLabel: true,
      topic: true,
      kind: true,
      createdAt: true,
      sourceUrl: true,
      originalFileName: true,
      storedFileName: true,
    },
  });

  const items: LibraryListItem[] = rows.map((r) => ({ ...r }));

  const forTopicList = filterByCourse(items, courseDecoded);
  const topicOptions = [
    ...new Set(
      forTopicList
        .map((i) => i.topic?.trim())
        .filter((t): t is string => Boolean(t))
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  let filtered = filterByCourse(items, courseDecoded);
  filtered = filterByTopic(filtered, topicRaw);
  filtered = sortItems(filtered, sortMode);
  const grouped = groupItemsByTopic(filtered);
  const serializedGroups = grouped.map((g) => ({
    topic: g.topic,
    items: g.items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
  }));
  const allowBulkDelete = courseDecoded !== 'all';

  const heading =
    courseDecoded === 'all' ? 'All items' :
    courseDecoded === 'uncategorized' ? 'Uncategorized'
    : courseDecoded;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <LibraryBulkProvider allowBulkDelete={allowBulkDelete}>
          <div className="flex flex-col gap-4 border-b border-stone-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">{heading}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                {courseDecoded !== 'all' ? ' in this class' : ''}
                {topicRaw ? ` · topic “${topicRaw}”` : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href="/library/add" className="text-sm font-medium text-sky-600 hover:text-sky-700">
                  + Add notes or files
                </Link>
                {courseDecoded !== 'all' && courseDecoded !== 'uncategorized' && (
                  <>
                    <Link
                      href={`/library/quiz?course=${encodeCourseParam(courseDecoded)}`}
                      className="text-sm font-medium text-violet-700 hover:text-violet-800"
                    >
                      Quiz mode
                    </Link>
                    <Link
                      href={`/library/study-sheet?course=${encodeCourseParam(courseDecoded)}`}
                      className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      Study sheet
                    </Link>
                  </>
                )}
              </div>
            </div>
            <Suspense fallback={<div className="h-9 w-56 animate-pulse rounded-lg bg-stone-100" />}>
              <LibraryToolbar />
            </Suspense>
          </div>

          <div className="mt-6">
            <LibraryTopicPills
              topics={topicOptions}
              activeTopic={topicRaw}
              courseParam={courseRaw}
            />
          </div>

          {filtered.length === 0 ?
            <div className="mt-12 rounded-2xl border border-dashed border-stone-200/90 bg-white/70 p-10 text-center">
              <p className="text-slate-600">Nothing here yet.</p>
              <p className="mt-2 text-sm text-slate-500">
                Try another class, clear filters,{' '}
                <Link href="/library/add" className="font-medium text-sky-600 hover:text-sky-700">
                  add a note or file
                </Link>
                , or import from the extension.
              </p>
              {(courseRaw || topicRaw) && (
                <Link
                  href="/library"
                  className="mt-4 inline-block text-sm font-medium text-sky-600 hover:text-sky-700"
                >
                  Show all items
                </Link>
              )}
            </div>
          : <LibraryGroupedList groups={serializedGroups} />
          }
        </LibraryBulkProvider>
      </div>
    </div>
  );
}
