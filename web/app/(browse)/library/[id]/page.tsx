import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { encodeCourseParam } from '@/lib/library-org';
import { kindLabel, KIND_FILE_UPLOAD, KIND_TEXT_NOTE } from '@/lib/material-kinds';
import { DeleteItemButton } from '@/components/delete-item-button';
import { ItemMetadataEditor } from '@/components/item-metadata-editor';

type Props = { params: Promise<{ id: string }> };

function formatBytes(n: number | null | undefined) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function LibraryItemPage({ params }: Props) {
  if (!(await isLibraryBrowserSession())) redirect('/login');

  const { id } = await params;
  const item = await prisma.libraryItem.findUnique({
    where: { id },
  });

  if (!item) notFound();

  const backHref =
    item.courseLabel?.trim() ?
      `/library?course=${encodeCourseParam(item.courseLabel)}`
    : '/library';

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 lg:px-8">
      <Link href={backHref} className="text-sm font-medium text-sky-600 hover:text-sky-700">
        ← Back to library
      </Link>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded-md bg-stone-100 px-2 py-0.5 font-medium text-slate-600">
          {kindLabel(item.kind)}
        </span>
        {item.courseLabel && (
          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-800">{item.courseLabel}</span>
        )}
        {item.topic && (
          <span className="rounded-md bg-violet-50/90 px-2 py-0.5 text-violet-800">{item.topic}</span>
        )}
      </div>
      <h1 className="mt-3 text-2xl font-semibold text-slate-800">{item.title}</h1>

      <ItemMetadataEditor
        itemId={item.id}
        initialTopic={item.topic}
        initialCourseLabel={item.courseLabel}
      />

      {item.kind === KIND_FILE_UPLOAD && item.storedFileName && (
        <section className="mt-6 rounded-xl border border-stone-200/80 bg-sky-50/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-800/90">File</h2>
          <p className="mt-1 text-sm text-slate-700">
            {item.originalFileName || 'Attachment'}{' '}
            {item.fileSize ? <span className="text-slate-500">({formatBytes(item.fileSize)})</span> : null}
          </p>
          <a
            href={`/api/files/${item.id}`}
            className="mt-3 inline-flex rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            Download
          </a>
        </section>
      )}

      {item.sourceUrl && item.kind !== KIND_FILE_UPLOAD && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-sky-600 hover:text-sky-700"
        >
          Source page
        </a>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {item.kind === KIND_TEXT_NOTE ? 'Preview' : 'Summary'}
        </h2>
        <div className="mt-2 whitespace-pre-wrap rounded-xl border border-stone-200/80 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
          {item.summary}
        </div>
      </section>

      {item.noteContent && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your notes</h2>
          <div className="mt-2 max-h-[min(70vh,36rem)] overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 text-sm leading-relaxed text-slate-700">
            {item.noteContent}
          </div>
        </section>
      )}

      {item.transcript && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Transcript</h2>
          <div className="mt-2 max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 text-sm leading-relaxed text-slate-700">
            {item.transcript}
          </div>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-dashed border-violet-200/80 bg-violet-50/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-800/80">Study tools</h2>
        <p className="mt-2 text-sm text-slate-600">
          Coming next: generate flashcards, study mode, or cheat sheets from this item with AI — all kept in
          this app next to your summaries and uploads.
        </p>
      </section>

      <DeleteItemButton itemId={item.id} itemTitle={item.title} />
    </div>
  );
}
