import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { AddMaterialForm } from '@/components/add-material-form';

export default async function AddMaterialPage() {
  if (!(await isLibraryBrowserSession())) redirect('/login');

  return (
    <div className="px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/library" className="text-sm font-medium text-sky-600 hover:text-sky-700">
          ← Back to library
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-slate-800">Add materials</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload slides, PDFs, or typed notes so everything lives with your extension summaries. Later you can
          plug in AI here to build flashcards, study sheets, and cheat sheets from any item.
        </p>
        <div className="mt-8">
          <AddMaterialForm />
        </div>
      </div>
    </div>
  );
}
