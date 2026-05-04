'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Props = {
  itemId: string;
  originalFileName: string | null;
  /** Lowercase extension without dot (from server). */
  ext: string;
  fileSizeLabel?: string | null;
};

export function LibraryFilePanel({ itemId, originalFileName, ext, fileSizeLabel }: Props) {
  const router = useRouter();
  const displayName = originalFileName || 'Attachment';
  const inlineUrl = `/api/files/${itemId}?inline=1`;
  const downloadUrl = `/api/files/${itemId}`;

  const isPdf = ext === 'pdf';
  const isPlain = ext === 'txt' || ext === 'md';

  const [plainText, setPlainText] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(!isPdf && !isPlain);
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  const [summarizing, setSummarizing] = useState(false);
  const [sumErr, setSumErr] = useState<string | null>(null);

  useEffect(() => {
    setPlainText(null);
    setExtracted(null);
    setPreviewNote(null);

    if (isPlain) {
      setPreviewLoading(true);
      fetch(inlineUrl, { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error('Load failed');
          return r.text();
        })
        .then((t) => setPlainText(t))
        .catch(() => setPreviewNote('Could not load this file for preview.'))
        .finally(() => setPreviewLoading(false));
      return;
    }

    if (isPdf) {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    fetch(`/api/items/${itemId}/preview-text`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { text?: string; emptyReason?: string }) => {
        if (d.text?.trim()) setExtracted(d.text);
        else setPreviewNote(d.emptyReason || 'No extractable text for preview.');
      })
      .catch(() => setPreviewNote('Could not extract preview text.'))
      .finally(() => setPreviewLoading(false));
  }, [itemId, inlineUrl, isPdf, isPlain]);

  async function summarize() {
    setSumErr(null);
    setSummarizing(true);
    try {
      const res = await fetch(`/api/items/${itemId}/summarize`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSumErr(typeof data.error === 'string' ? data.error : 'Summarize failed');
        return;
      }
      router.refresh();
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-stone-200/80 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-800/90">File</h2>
          <p className="mt-1 text-sm text-slate-700">
            {displayName}
            {fileSizeLabel ? <span className="text-slate-500"> · {fileSizeLabel}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={downloadUrl}
            className="inline-flex rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-50"
          >
            Download
          </a>
          <button
            type="button"
            onClick={() => void summarize()}
            disabled={summarizing}
            className="inline-flex rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50"
          >
            {summarizing ? 'Summarizing…' : 'AI summarize document'}
          </button>
        </div>
      </div>

      {sumErr && (
        <p className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800">{sumErr}</p>
      )}

      <div className="rounded-lg border border-stone-200/80 bg-white">
        <p className="border-b border-stone-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Preview
        </p>
        <div className="p-3">
          {isPdf && (
            <iframe title={displayName} src={inlineUrl} className="min-h-[min(70vh,560px)] w-full rounded-md border border-stone-200/90 bg-stone-50" />
          )}

          {isPlain && previewLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {isPlain && plainText !== null && (
            <pre className="max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-md bg-stone-50/80 p-3 text-sm leading-relaxed text-slate-800">
              {plainText}
            </pre>
          )}

          {!isPdf && !isPlain && previewLoading && <p className="text-sm text-slate-500">Extracting text…</p>}
          {!isPdf && !isPlain && extracted && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Text extracted for slides or Word documents (best-effort). PDFs use the visual preview above when you
                upload .pdf.
              </p>
              <pre className="max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-md bg-stone-50/80 p-3 text-sm leading-relaxed text-slate-800">
                {extracted}
              </pre>
            </div>
          )}

          {!isPdf && !isPlain && !previewLoading && !extracted && previewNote && (
            <p className="text-sm text-slate-600">{previewNote}</p>
          )}
        </div>
      </div>
    </section>
  );
}
