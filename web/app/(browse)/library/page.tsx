import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { isLibraryBrowserSession } from '@/lib/library-access';
import {
  decodeCourseParam,
  filterByCourse,
  filterByTopic,
  groupItemsByTopic,
  parseSortMode,
  sortItems,
  type LibraryListItem,
} from '@/lib/library-org';
import { LibrarySortBar } from '@/components/library-sort-bar';
import { LibraryTopicPills } from '@/components/library-topic-pills';
import { kindLabel } from '@/lib/material-kinds';

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

  const heading =
    courseDecoded === 'all' ? 'All items' :
    courseDecoded === 'uncategorized' ? 'Uncategorized'
    : courseDecoded;

  return (
    <div className="px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 border-b border-stone-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{heading}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              {courseDecoded !== 'all' ? ' in this class' : ''}
              {topicRaw ? ` · topic “${topicRaw}”` : ''}
            </p>
            <Link
              href="/library/add"
              className="mt-3 inline-flex text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              + Add notes or files
            </Link>
          </div>
          <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-lg bg-stone-100" />}>
            <LibrarySortBar />
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
        : <div className="mt-10 flex flex-col gap-10">
            {grouped.map((group) => (
              <section key={group.topic}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.topic}
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/library/${item.id}`}
                        className="block rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:border-sky-200/80 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 font-medium text-slate-600">
                            {kindLabel(item.kind)}
                          </span>
                          {item.storedFileName && (
                            <span className="text-slate-400" title={item.originalFileName || 'File'}>
                              · file
                            </span>
                          )}
                          {item.courseLabel && (
                            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-800">
                              {item.courseLabel}
                            </span>
                          )}
                          {item.topic && (
                            <span className="rounded-md bg-violet-50/90 px-2 py-0.5 text-violet-800">
                              {item.topic}
                            </span>
                          )}
                          <time dateTime={item.createdAt.toISOString()} className="text-slate-400">
                            {item.createdAt.toLocaleString()}
                          </time>
                        </div>
                        <h3 className="mt-2 font-semibold text-slate-800">{item.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.summary}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        }
      </div>
    </div>
  );
}
