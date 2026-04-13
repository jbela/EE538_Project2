'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'topic', label: 'Topic A–Z' },
] as const;

export function LibrarySortBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const sort = sp.get('sort') || 'newest';
  const course = sp.get('course');
  const topic = sp.get('topic');

  function applySort(next: string) {
    const p = new URLSearchParams();
    if (course) p.set('course', course);
    if (topic) p.set('topic', topic);
    if (next && next !== 'newest') p.set('sort', next);
    const q = p.toString();
    router.push(q ? `/library?${q}` : '/library');
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="lib-sort" className="text-xs font-medium text-slate-500">
        Sort
      </label>
      <select
        id="lib-sort"
        value={sort}
        onChange={(e) => applySort(e.target.value)}
        className="rounded-lg border border-stone-200/90 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
