'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Props = {
  itemId: string;
  initialTopic: string | null;
  initialCourseLabel: string | null;
};

export function ItemMetadataEditor({ itemId, initialTopic, initialCourseLabel }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic ?? '');
  const [courseLabel, setCourseLabel] = useState(initialCourseLabel ?? '');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTopic(initialTopic ?? '');
    setCourseLabel(initialCourseLabel ?? '');
  }, [itemId, initialTopic, initialCourseLabel]);

  useEffect(() => {
    setSaved(false);
  }, [itemId]);

  const dirty =
    topic.trim() !== (initialTopic ?? '').trim() ||
    courseLabel.trim() !== (initialCourseLabel ?? '').trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topic: topic.trim() || null,
          courseLabel: courseLabel.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Save failed');
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Class &amp; topic</h2>
      <p className="mt-1 text-sm text-slate-500">
        Organize this entry with a course name and an optional topic (e.g. “Midterm review”).
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-500">Course / class</label>
          <input
            value={courseLabel}
            onChange={(e) => setCourseLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="e.g. EE538"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="e.g. Laplace transforms"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          {saved && !dirty && <span className="text-sm text-emerald-600">Saved.</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </form>
    </section>
  );
}
