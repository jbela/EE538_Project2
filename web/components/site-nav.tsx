import Image from 'next/image';
import Link from 'next/link';
import { isLibraryBrowserSession } from '@/lib/library-access';
import { logoutLibrary } from '@/app/login/actions';

export async function SiteNav() {
  const unlocked = await isLibraryBrowserSession();

  return (
    <header className="border-b border-stone-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-slate-800"
        >
          <Image
            src="/lecture-library-icon.png"
            alt=""
            width={22}
            height={22}
            className="size-[1.125rem] shrink-0 object-contain"
            priority
            aria-hidden
          />
          <span>Lecture Library</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
          {unlocked ?
            <>
              <Link
                href="/"
                className="rounded-lg px-2 py-1.5 hover:bg-stone-100/90 hover:text-slate-800"
              >
                Home
              </Link>
              <Link
                href="/library"
                className="rounded-lg px-2 py-1.5 hover:bg-stone-100/90 hover:text-slate-800"
              >
                Library
              </Link>
              <Link
                href="/library/add"
                className="rounded-lg px-2 py-1.5 hover:bg-stone-100/90 hover:text-slate-800"
              >
                Add
              </Link>
              <form action={logoutLibrary} className="inline">
                <button
                  type="submit"
                  className="rounded-lg border border-stone-200/90 bg-white px-3 py-1.5 text-slate-700 shadow-sm hover:bg-stone-50/90"
                >
                  Lock
                </button>
              </form>
            </>
          : <Link
              href="/login"
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-white shadow-sm shadow-sky-500/15 hover:bg-sky-600"
            >
              Unlock
            </Link>}
        </nav>
      </div>
    </header>
  );
}
