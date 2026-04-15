'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLibraryBulkSelection } from '@/components/library-bulk-selection-context';
import { kindLabel } from '@/lib/material-kinds';
import type { LibraryListItem } from '@/lib/library-org';

export type SerializedLibraryListItem = Omit<LibraryListItem, 'createdAt'> & { createdAt: string };

type Group = { topic: string; items: SerializedLibraryListItem[] };

type Props = {
  groups: Group[];
};

export function LibraryGroupedList({ groups }: Props) {
  const router = useRouter();
  const { allowBulkDelete, selectionMode } = useLibraryBulkSelection();
  const showBulkUi = allowBulkDelete && selectionMode;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectionMode) setSelected(new Set());
  }, [selectionMode]);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of groups) {
      for (const i of g.items) ids.push(i.id);
    }
    return ids;
  }, [groups]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(allIds));
  }, [allIds]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const allSelected = allIds.length > 0 && selected.size === allIds.length;

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} selected ${ids.length === 1 ? 'item' : 'items'}? This cannot be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    setErr(null);
    try {
      const res = await fetch('/api/items/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Delete failed');
        return;
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-10">
      {showBulkUi && allIds.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200/90 bg-stone-50/95 px-4 py-3 text-sm shadow-sm backdrop-blur-sm">
          <span className="font-medium text-slate-700">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={allSelected ? clearSelection : selectAll}
            className="rounded-lg border border-stone-200/90 bg-white px-3 py-1.5 text-slate-700 hover:bg-stone-50"
          >
            {allSelected ? 'Clear selection' : 'Select all visible'}
          </button>
          <button
            type="button"
            onClick={() => deleteSelected()}
            disabled={pending || selected.size === 0}
            className="rounded-lg border border-red-200/90 bg-red-50 px-3 py-1.5 font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {pending ? 'Deleting…' : 'Delete selected'}
          </button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.topic}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{group.topic}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {group.items.map((item) => {
              const checked = selected.has(item.id);
              return (
                <li key={item.id} className="flex gap-3">
                  {showBulkUi && (
                    <label className="flex shrink-0 items-start pt-4">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 rounded border-stone-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="sr-only">Select {item.title}</span>
                    </label>
                  )}
                  <Link
                    href={`/library/${item.id}`}
                    className="block min-w-0 flex-1 rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:border-sky-200/80 hover:shadow-md"
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
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-800">{item.courseLabel}</span>
                      )}
                      {item.topic && (
                        <span className="rounded-md bg-violet-50/90 px-2 py-0.5 text-violet-800">
                          {item.topic}
                        </span>
                      )}
                      <time dateTime={item.createdAt} className="text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-800">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.summary}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
