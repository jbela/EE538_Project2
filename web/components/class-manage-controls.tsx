'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Stored course label; null means uncategorized bucket */
  label: string | null;
  display: string;
  count: number;
};

export function ClassManageControls({ label, display, count }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const named = Boolean(label?.trim());
  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (renameOpen && label?.trim()) setNewName(label.trim());
  }, [renameOpen, label]);

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const from = label?.trim();
    const to = newName.trim();
    if (!from || !to) return;
    setPending(true);
    setErr(null);
    try {
      const res = await fetch('/api/course/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fromLabel: from, toLabel: to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Rename failed');
        return;
      }
      setRenameOpen(false);
      closeMenu();
      router.replace(`/library?course=${encodeURIComponent(to)}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitDeleteAll() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch('/api/course/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(named ? { label: label!.trim() } : { uncategorized: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Delete failed');
        return;
      }
      setDeleteOpen(false);
      closeMenu();
      router.push('/library');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0 pt-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-1.5 py-1 text-lg leading-none text-slate-400 hover:bg-stone-100 hover:text-slate-600"
        aria-expanded={open}
        aria-label={`Class options for ${display}`}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-stone-200/90 bg-white py-1 text-sm shadow-lg">
          {named && (
            <button
              type="button"
              onClick={() => {
                setRenameOpen(true);
                closeMenu();
              }}
              className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-stone-50"
            >
              Rename class…
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              closeMenu();
            }}
            className="block w-full px-3 py-2 text-left text-red-700 hover:bg-red-50"
          >
            Delete class &amp; all items…
          </button>
        </div>
      )}

      {renameOpen && named && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog">
          <form
            onSubmit={submitRename}
            className="w-full max-w-md rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-800">Rename class</h3>
            <p className="mt-1 text-sm text-slate-500">Updates every item that uses this course name.</p>
            <label className="mt-4 block text-xs font-medium text-slate-500">New name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
              autoFocus
            />
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !newName.trim()}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Rename'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Delete class</h3>
            <p className="mt-2 text-sm text-slate-600">
              Permanently remove all {count} {count === 1 ? 'item' : 'items'} in “{display}”.
              {err && <span className="mt-2 block text-red-600">{err}</span>}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitDeleteAll()}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? 'Deleting…' : 'Delete all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
