import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { encodeCourseParam } from '@/lib/library-org';
import { kindLabel, KIND_FILE_UPLOAD, KIND_TEXT_NOTE } from '@/lib/material-kinds';
import { extFromName } from '@/lib/uploads';
import { LibraryFilePanel } from '@/components/library-file-panel';
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

  const fileExt = extFromName(item.originalFileName || '');

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
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
        <LibraryFilePanel
          itemId={item.id}
          originalFileName={item.originalFileName}
          ext={fileExt}
          fileSizeLabel={item.fileSize ? formatBytes(item.fileSize) : null}
        />
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

      {item.courseLabel?.trim() && (
        <section className="mt-10 rounded-xl border border-dashed border-violet-200/80 bg-violet-50/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-800/80">Study tools</h2>
          <p className="mt-2 text-sm text-slate-600">
            Quiz mode and study sheets use everything saved under this class — summaries, notes, transcripts, and
            extracted document text.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/library/quiz?course=${encodeCourseParam(item.courseLabel)}`}
              className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Open class quiz
            </Link>
            <Link
              href={`/library/study-sheet?course=${encodeCourseParam(item.courseLabel)}`}
              className="inline-flex rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
            >
              Study sheet
            </Link>
          </div>
        </section>
      )}

      <DeleteItemButton itemId={item.id} itemTitle={item.title} />
    </div>
  );
}
