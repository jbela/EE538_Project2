'use client';

import { useActionState } from 'react';
import { loginWithLibraryKey } from './actions';

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginWithLibraryKey, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="key" className="block text-sm font-medium text-slate-700">
          Library access key
        </label>
        <input
          id="key"
          name="key"
          type="password"
          autoComplete="off"
          required
          className="mt-2 w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
          placeholder="Same value as LIBRARY_API_KEY in web/.env"
        />
        <p className="mt-2 text-xs text-slate-500">
          Same key as in the Chrome extension (&quot;Access key&quot; field) for exports.
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Unlock library'}
      </button>
    </form>
  );
}
