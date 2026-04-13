import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  if (await isLibraryBrowserSession()) redirect('/');

  const configured = !!(process.env.LIBRARY_API_KEY && process.env.LIBRARY_COOKIE_SECRET);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <h1 className="text-2xl font-semibold text-slate-800">Library access</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter the shared access key from your <code className="rounded-md bg-stone-100 px-1.5 py-0.5 text-slate-700">web/.env</code>{' '}
        file (<span className="font-mono text-xs">LIBRARY_API_KEY</span>). Local demo only.
      </p>

      {!configured ?
        <div className="mt-8 rounded-xl border border-amber-100 bg-amber-50/90 p-4 text-sm text-amber-950">
          <p className="font-medium">Environment not ready.</p>
          <p className="mt-2 text-amber-900/85">
            Set <code className="rounded bg-amber-100/80 px-1">LIBRARY_API_KEY</code> and{' '}
            <code className="rounded bg-amber-100/80 px-1">LIBRARY_COOKIE_SECRET</code> in{' '}
            <code className="rounded bg-amber-100/80 px-1">web/.env</code> (see{' '}
            <code className="rounded bg-amber-100/80 px-1">web/.env.example</code>).
          </p>
        </div>
      : <LoginForm />}

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/" className="font-medium text-sky-600 hover:text-sky-700">
          Back to home
        </Link>
      </p>
    </div>
  );
}
