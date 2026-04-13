export type LibraryListItem = {
  id: string;
  title: string;
  summary: string;
  courseLabel: string | null;
  topic: string | null;
  kind: string;
  createdAt: Date;
  sourceUrl: string | null;
  originalFileName?: string | null;
  storedFileName?: string | null;
};

const UNCATEGORIZED_PARAM = '_uncat_';

export function encodeCourseParam(label: string | null): string {
  if (label === null || label === '') return UNCATEGORIZED_PARAM;
  return encodeURIComponent(label);
}

export function decodeCourseParam(param: string | null | undefined): 'all' | 'uncategorized' | string {
  if (!param) return 'all';
  if (param === UNCATEGORIZED_PARAM) return 'uncategorized';
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

export function filterByCourse(
  items: LibraryListItem[],
  course: ReturnType<typeof decodeCourseParam>
): LibraryListItem[] {
  if (course === 'all') return items;
  if (course === 'uncategorized') return items.filter((i) => !i.courseLabel?.trim());
  return items.filter((i) => (i.courseLabel || '').trim() === course);
}

export function filterByTopic(items: LibraryListItem[], topicParam: string | null | undefined): LibraryListItem[] {
  if (!topicParam) return items;
  const t = topicParam.trim().toLowerCase();
  return items.filter((i) => (i.topic || '').trim().toLowerCase() === t);
}

export type SortMode = 'newest' | 'oldest' | 'title' | 'topic';

export function parseSortMode(raw: string | null | undefined): SortMode {
  if (raw === 'oldest' || raw === 'title' || raw === 'topic') return raw;
  return 'newest';
}

export function sortItems(items: LibraryListItem[], sort: SortMode): LibraryListItem[] {
  const copy = [...items];
  switch (sort) {
    case 'oldest':
      copy.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      break;
    case 'title':
      copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      break;
    case 'topic':
      copy.sort((a, b) =>
        (a.topic || '').localeCompare(b.topic || '', undefined, { sensitivity: 'base' })
      );
      break;
    default:
      copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return copy;
}

export function groupItemsByTopic(items: LibraryListItem[]): { topic: string; items: LibraryListItem[] }[] {
  const map = new Map<string, LibraryListItem[]>();
  for (const item of items) {
    const label = item.topic?.trim() || 'General';
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(item);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  return keys.map((topic) => ({ topic, items: map.get(topic)! }));
}

export type ClassNavEntry = { label: string | null; display: string; count: number };

export function buildClassNav(
  groups: { courseLabel: string | null; _count: { id: number } }[]
): ClassNavEntry[] {
  const entries: ClassNavEntry[] = groups.map((g) => ({
    label: g.courseLabel,
    display: g.courseLabel?.trim() || 'Uncategorized',
    count: g._count.id,
  }));
  entries.sort((a, b) => {
    const aUncat = !a.label?.trim();
    const bUncat = !b.label?.trim();
    if (aUncat && !bUncat) return 1;
    if (!aUncat && bUncat) return -1;
    return a.display.localeCompare(b.display, undefined, { sensitivity: 'base' });
  });
  return entries;
}
