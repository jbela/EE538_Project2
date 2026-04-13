'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Tab = 'upload' | 'note';

export function AddMaterialForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upload');
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [courseLabel, setCourseLabel] = useState('');
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!file) {
      setErr('Choose a file first.');
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (title.trim()) fd.append('title', title.trim());
      if (courseLabel.trim()) fd.append('courseLabel', courseLabel.trim());
      if (topic.trim()) fd.append('topic', topic.trim());
      const res = await fetch('/api/items/upload', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Upload failed');
        return;
      }
      router.push(`/library/${data.item.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!title.trim() || !noteContent.trim()) {
      setErr('Title and note text are required.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/items/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          noteContent: noteContent.trim(),
          courseLabel: courseLabel.trim() || undefined,
          topic: topic.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Save failed');
        return;
      }
      router.push(`/library/${data.item.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(t);
        setErr(null);
      }}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        tab === t ?
          'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
        : 'bg-stone-100/90 text-slate-600 hover:bg-stone-200/80'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {tabBtn('upload', 'Upload file')}
        {tabBtn('note', 'Text note')}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-500">Course (optional)</label>
          <input
            value={courseLabel}
            onChange={(e) => setCourseLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="e.g. EE538"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Topic (optional)</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="e.g. Midterm review"
          />
        </div>
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      {tab === 'upload' ?
        <form onSubmit={submitUpload} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
              placeholder="Defaults to file name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.rtf"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-800 hover:file:bg-sky-100"
            />
            <p className="mt-2 text-xs text-slate-400">
              PDF, PowerPoint, Word, text, Markdown — max 25 MB. (Future: AI can read these for flashcards /
              study mode.)
            </p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-50"
          >
            {pending ? 'Uploading…' : 'Add to library'}
          </button>
        </form>
      : <form onSubmit={submitNote} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
              placeholder="Short label for this note"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Note</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
              rows={12}
              className="mt-1 w-full rounded-lg border border-stone-200/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
              placeholder="Paste lecture notes, outline, or anything you want next to your summaries…"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save note'}
          </button>
        </form>
      }
    </div>
  );
}
