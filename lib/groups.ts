/** Splits an already-ordered list into consecutive groups (activities without a group go under "Other"). */
export type Grouped<T> = { key: string; name: string; items: T[] };

export function groupBy<T extends { groupId: number | null; groupName: string | null }>(items: T[]): Grouped<T>[] {
  const groups: Grouped<T>[] = [];
  const byKey = new Map<string, Grouped<T>>();
  for (const item of items) {
    const key = item.groupId === null ? "other" : String(item.groupId);
    let group = byKey.get(key);
    if (!group) {
      group = { key, name: item.groupName ?? "Other", items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** SQL ORDER BY fragment: group order first (ungrouped last), then activity order. Needs aliases `g` and `a`. */
export const GROUPED_ORDER = "(g.sort_order IS NULL), g.sort_order, g.id, a.sort_order, a.id";
