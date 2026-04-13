'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { decodeCourseParam, encodeCourseParam } from '@/lib/library-org';

export type SidebarClass = { label: string | null; display: string; count: number };

type Props = {
  total: number;
  classes: SidebarClass[];
};

export function LibrarySidebarClient({ total, classes }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const courseQ = sp.get('course');
  const decodedCourse = decodeCourseParam(courseQ ?? undefined);
  const isLibraryRoot = pathname === '/library';
  const isLibrarySection = pathname.startsWith('/library');

  const navCls = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm transition ${
      active
        ? 'bg-sky-50/90 font-medium text-sky-900'
        : 'text-slate-600 hover:bg-stone-100/90'
    }`;

  const allItemsActive = isLibraryRoot && decodedCourse === 'all';

  return (
    <aside className="w-56 shrink-0 border-r border-stone-200/70 bg-white/95 py-5 pl-4 pr-2 shadow-[1px_0_0_rgba(0,0,0,0.02)]">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Browse</p>
      <nav className="mt-2 flex flex-col gap-0.5">
        <Link href="/" className={navCls(pathname === '/')}>
          Home
        </Link>
        <Link href="/library" className={navCls(allItemsActive)}>
          All items
          <span className="ml-1 text-xs font-normal text-slate-400">({total})</span>
        </Link>
        <Link href="/library/add" className={navCls(pathname === '/library/add')}>
          Add materials
        </Link>
      </nav>

      <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Classes</p>
      <nav className="mt-2 flex max-h-[min(60vh,28rem)] flex-col gap-0.5 overflow-y-auto pr-1">
        {classes.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">No classes yet — add a course when exporting.</p>
        ) : (
          classes.map((c) => {
            const param = encodeCourseParam(c.label);
            const active =
              isLibrarySection &&
              ((decodedCourse === 'uncategorized' && (!c.label || !c.label.trim())) ||
                (typeof decodedCourse === 'string' &&
                  decodedCourse !== 'all' &&
                  decodedCourse !== 'uncategorized' &&
                  (c.label || '').trim() === decodedCourse));
            return (
              <Link
                key={param + c.display}
                href={`/library?course=${param}`}
                className={navCls(!!active)}
              >
                <span className="line-clamp-2">{c.display}</span>
                <span className="block text-[11px] font-normal text-slate-400">{c.count} items</span>
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
