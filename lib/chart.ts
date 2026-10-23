import type { Bar } from "@/components/BarChart";
import type { WeekSummary } from "./history";
import { formatShortDate } from "./week";

/** Week summaries (any order) → chart bars, oldest first. */
export function summariesToBars(weeks: WeekSummary[]): Bar[] {
  return [...weeks]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((w) => {
      const tone: Bar["tone"] = w.status === "submitted" ? "done" : w.status === "current" || w.status === "open" ? "current" : "missed";
      const status = w.status === "submitted" ? "Submitted" : w.status === "current" ? "In progress" : w.status === "open" ? "Still open" : "Not submitted";
      return {
        key: w.weekStart,
        label: formatShortDate(w.weekStart),
        ratio: w.max ? w.total / w.max : 0,
        tone,
        description: `${w.total}${w.max !== null ? ` / ${w.max}` : ""} pts · ${status}`,
      };
    });
}
