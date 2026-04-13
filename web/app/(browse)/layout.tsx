import { LibrarySidebar } from '@/components/library-sidebar';
import { isLibraryBrowserSession } from '@/lib/library-access';

export default async function BrowseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const unlocked = await isLibraryBrowserSession();

  if (!unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-3.25rem)]">
      <LibrarySidebar />
      <div className="min-w-0 flex-1 bg-[var(--background)]">{children}</div>
    </div>
  );
}
