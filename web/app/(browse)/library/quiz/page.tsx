import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CourseQuizClient } from '@/components/course-quiz-client';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { decodeCourseParam, encodeCourseParam } from '@/lib/library-org';

type Props = { searchParams: Promise<{ course?: string }> };

export default async function LibraryQuizPage({ searchParams }: Props) {
  if (!(await isLibraryBrowserSession())) redirect('/login');

  const sp = await searchParams;
  const courseRaw = sp.course?.trim() || '';
  const courseDecoded = decodeCourseParam(courseRaw || undefined);

  if (courseDecoded === 'all' || courseDecoded === 'uncategorized' || !courseRaw) {
    redirect('/library');
  }

  const backHref = `/library?course=${encodeCourseParam(courseDecoded)}`;
  const sheetHref = `/library/study-sheet?course=${encodeCourseParam(courseDecoded)}`;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
      <Link href={backHref} className="text-sm font-medium text-sky-600 hover:text-sky-700">
        ← Back to class library
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold text-slate-800">Quiz · {courseDecoded}</h1>
        <Link href={sheetHref} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Study sheet →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Flashcards and multiple-choice questions generated from all materials in this class. Requires the summarize
        backend with <code className="rounded bg-stone-100 px-1">OPENAI_API_KEY</code>.
      </p>
      <CourseQuizClient courseLabel={courseDecoded} />
    </div>
  );
}
