import Link from 'next/link';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { prisma } from '@/lib/prisma';
import { kindLabel } from '@/lib/material-kinds';

export default async function HomePage() {
  const unlocked = await isLibraryBrowserSession();

  const recent =
    unlocked ?
      await prisma.libraryItem.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          title: true,
          summary: true,
          courseLabel: true,
          topic: true,
          kind: true,
          createdAt: true,
          storedFileName: true,
        },
      })
    : [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-sky-600/90">EE538 · Lecture Assistant</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800">
        Your lecture library
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Summaries from the extension, your own files, and typed notes — together by <strong>class</strong> and{' '}
        <strong>topic</strong>. A future step is AI-generated flashcards and study sheets from any item.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {unlocked ?
          <Link
            href="/library"
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600"
          >
            Open library
          </Link>
        : <Link
            href="/login"
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600"
          >
            Unlock library
          </Link>}
        {unlocked && (
          <Link
            href="/library/add"
            className="rounded-xl border border-stone-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50/80"
          >
            Add notes / files
          </Link>
        )}
        <Link
          href="/login"
          className="rounded-xl border border-stone-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50/80"
        >
          Access key
        </Link>
      </div>

      {unlocked && (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4 border-b border-stone-200/80 pb-3">
            <h2 className="text-lg font-semibold text-slate-800">Recently imported</h2>
            <Link href="/library" className="text-sm font-medium text-sky-600 hover:text-sky-700">
              View all →
            </Link>
          </div>

          {recent.length === 0 ?
            <p className="mt-8 rounded-2xl border border-dashed border-stone-200/90 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
              No items yet. Use the extension, or{' '}
              <Link href="/library/add" className="font-medium text-sky-600 hover:text-sky-700">
                add notes and files
              </Link>
              .
            </p>
          : <ul className="mt-6 flex flex-col gap-3">
              {recent.map((item) => (
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
                        <span className="text-slate-400">· file</span>
                      )}
                      {item.courseLabel && (
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-800">{item.courseLabel}</span>
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
          }
        </section>
      )}
    </main>
  );
}
