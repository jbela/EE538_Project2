'use client';

import { useCallback, useRef, useState } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = { courseLabel: string };

const studySheetMdComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mt-2 border-b border-slate-200 pb-2 text-2xl font-bold tracking-tight text-slate-900 print:text-3xl print:border-slate-400"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-8 text-xl font-semibold text-slate-800 print:mt-6 print:text-2xl" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-5 text-lg font-semibold text-slate-800 print:text-xl" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mt-4 text-base font-semibold text-slate-700" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mt-3 text-[15px] leading-relaxed text-slate-700 print:text-[13pt]" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[15px] leading-relaxed text-slate-700" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-relaxed text-slate-700" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1 marker:text-slate-500" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-900" {...props}>
      {children}
    </strong>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mt-3 border-l-4 border-sky-300 bg-sky-50/60 py-2 pl-4 pr-3 text-slate-700 italic print:bg-transparent"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes('language-'));
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800 print:bg-slate-100"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800 print:border-slate-300"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="mt-4 overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-left text-sm text-slate-800" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-100 print:bg-slate-100" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-slate-300 px-3 py-2 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-slate-200 px-3 py-2 align-top" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="even:bg-slate-50/80" {...props}>
      {children}
    </tr>
  ),
  hr: ({ ...props }) => <hr className="my-8 border-slate-200" {...props} />,
  a: ({ children, ...props }) => (
    <a className="text-sky-700 underline decoration-sky-300 underline-offset-2" {...props}>
      {children}
    </a>
  ),
};

function openPrintablePdf(sourceEl: HTMLElement, documentTitle: string) {
  const styles = `
    @page { margin: 16mm; }
    body { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; color: #0f172a; line-height: 1.5; max-width: 900px; margin: 0 auto; padding: 0 8px; }
    h1 { font-size: 1.75rem; border-bottom: 2px solid #334155; padding-bottom: 0.5rem; margin-top: 0; }
    h2 { font-size: 1.35rem; margin-top: 1.5rem; color: #1e293b; }
    h3 { font-size: 1.15rem; margin-top: 1.1rem; color: #334155; }
    p { margin: 0.55em 0; font-size: 11.5pt; }
    ul, ol { padding-left: 1.35em; margin: 0.5em 0; font-size: 11.5pt; }
    li { margin: 0.25em 0; }
    code { font-family: ui-monospace, monospace; font-size: 0.92em; background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 4px; }
    pre { font-family: ui-monospace, monospace; font-size: 0.88rem; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
    blockquote { border-left: 4px solid #7dd3fc; margin: 1em 0; padding-left: 1em; color: #475569; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 11pt; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
  `;

  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Pop-up blocked — allow pop-ups for this site to print or save as PDF.');
    return;
  }

  const docHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(documentTitle)}</title><style>${styles}</style></head><body>${sourceEl.innerHTML}</body></html>`;
  w.document.open();
  w.document.write(docHtml);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function StudySheetClient({ courseLabel }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>('');
  const [model, setModel] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setErr(null);
    setLoading(true);
    setMarkdown('');
    setModel(null);
    try {
      const res = await fetch('/api/course/study-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseLabel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Could not generate study sheet');
        return;
      }
      const sheet = typeof data.studySheet === 'string' ? data.studySheet : '';
      setMarkdown(sheet);
      setModel(typeof data.model === 'string' ? data.model : null);
    } finally {
      setLoading(false);
    }
  }, [courseLabel]);

  const downloadPdf = useCallback(() => {
    const el = printRef.current;
    if (!el || !markdown.trim()) return;
    openPrintablePdf(el, `Study sheet — ${courseLabel}`);
  }, [courseLabel, markdown]);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate study sheet'}
        </button>
        {markdown.trim() ? (
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Download PDF
          </button>
        ) : null}
      </div>

      {err && (
        <p className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      {!loading && !markdown.trim() && !err && (
        <p className="text-sm text-slate-600">
          Generate a structured Markdown study sheet, then use <strong>Download PDF</strong> to open the print dialog and
          save as PDF (choose “Save as PDF” as the printer on desktop browsers).
        </p>
      )}

      {markdown.trim() ? (
        <div className="rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <div ref={printRef} className="study-sheet-markdown max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={studySheetMdComponents}>
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}
