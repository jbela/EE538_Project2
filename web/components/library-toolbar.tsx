'use client';

import { LibrarySortBar } from '@/components/library-sort-bar';
import { useLibraryBulkSelection } from '@/components/library-bulk-selection-context';

export function LibraryToolbar() {
  const { allowBulkDelete, selectionMode, toggleSelectionMode } = useLibraryBulkSelection();

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {allowBulkDelete && (
        <button
          type="button"
          onClick={toggleSelectionMode}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-200 ${
            selectionMode
              ? 'border-sky-300 bg-sky-50 text-sky-900'
              : 'border-stone-200/90 bg-white text-slate-700 hover:bg-stone-50'
          }`}
        >
          {selectionMode ? 'Done' : 'Select'}
        </button>
      )}
      <LibrarySortBar />
    </div>
  );
}
