'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Ctx = {
  allowBulkDelete: boolean;
  selectionMode: boolean;
  setSelectionMode: (v: boolean) => void;
  toggleSelectionMode: () => void;
};

const LibraryBulkSelectionContext = createContext<Ctx | null>(null);

export function LibraryBulkProvider({
  allowBulkDelete,
  children,
}: {
  allowBulkDelete: boolean;
  children: ReactNode;
}) {
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((s) => !s);
  }, []);

  const value = useMemo(
    () => ({
      allowBulkDelete,
      selectionMode,
      setSelectionMode,
      toggleSelectionMode,
    }),
    [allowBulkDelete, selectionMode, toggleSelectionMode]
  );

  return (
    <LibraryBulkSelectionContext.Provider value={value}>{children}</LibraryBulkSelectionContext.Provider>
  );
}

export function useLibraryBulkSelection(): Ctx {
  const ctx = useContext(LibraryBulkSelectionContext);
  if (!ctx) {
    throw new Error('useLibraryBulkSelection must be used within LibraryBulkProvider');
  }
  return ctx;
}
