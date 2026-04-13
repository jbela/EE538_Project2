'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { itemId: string; itemTitle: string };

export function DeleteItemButton({ itemId, itemTitle }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onDelete() {
    const label = itemTitle.slice(0, 48) + (itemTitle.length > 48 ? '…' : '');
    if (!confirm(`Delete “${label}”? This cannot be undone.`)) return;
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Delete failed');
        return;
      }
      router.push('/library');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 border-t border-stone-200/80 pt-8">
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={() => onDelete()}
        disabled={pending}
        className="rounded-lg border border-red-200/90 bg-red-50/80 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100/80 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete this item'}
      </button>
      <p className="mt-2 text-xs text-slate-400">
        Removes this entry from your library and deletes any stored file on the server.
      </p>
    </div>
  );
}
