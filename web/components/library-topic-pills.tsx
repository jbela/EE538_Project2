import Link from 'next/link';

type Props = {
  topics: string[];
  activeTopic: string | null;
  courseParam: string | null;
};

export function LibraryTopicPills({ topics, activeTopic, courseParam }: Props) {
  if (topics.length === 0) return null;

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      active
        ? 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80'
        : 'bg-stone-100/90 text-slate-600 hover:bg-stone-200/80'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Topics</span>
      {courseParam && (
        <Link
          href={`/library?course=${courseParam}`}
          className={pill(!activeTopic)}
        >
          All topics
        </Link>
      )}
      {!courseParam && (
        <Link href="/library" className={pill(!activeTopic)}>
          All topics
        </Link>
      )}
      {topics.map((t) => {
        const enc = encodeURIComponent(t);
        const href = courseParam
          ? `/library?course=${courseParam}&topic=${enc}`
          : `/library?topic=${enc}`;
        const active = activeTopic?.toLowerCase() === t.toLowerCase();
        return (
          <Link key={t} href={href} className={pill(active)}>
            {t}
          </Link>
        );
      })}
    </div>
  );
}
