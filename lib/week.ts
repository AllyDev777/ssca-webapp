// IST week math. Weeks run Monday 00:00 → Sunday 23:59:59 Asia/Kolkata and are
// identified by their Monday as 'YYYY-MM-DD'. IST is a fixed UTC+05:30 (no DST),
// so plain offset arithmetic is exact.

export const TIMEZONE = "Asia/Kolkata";
/**
 * Days after a week ends during which an unsubmitted week can still be edited/submitted.
 * 1 = last week stays open until Monday 11:59 pm IST. Keep it under 7, so at most one
 * past week is ever open (the UI assumes that).
 */
export const ALLOW_LATE_SUBMISSION_DAYS = 1;

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

function toIso(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function parseIso(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

/** Monday (IST) of the week containing `date`. */
export function getWeekStart(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  return toIso(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysSinceMonday));
}

export function addWeeks(weekStart: string, weeks: number): string {
  return toIso(parseIso(weekStart) + weeks * 7 * DAY_MS);
}

/** The UTC instant the week ends (next Monday 00:00 IST). */
export function weekEndsAt(weekStart: string): Date {
  return new Date(parseIso(weekStart) + 7 * DAY_MS - IST_OFFSET_MS);
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = parseIso(value);
  return !Number.isNaN(ms) && toIso(ms) === value;
}

/** Monday of the IST week containing a calendar date. */
export function weekStartOfDate(isoDate: string): string {
  const day = new Date(parseIso(isoDate)).getUTCDay();
  return toIso(parseIso(isoDate) - ((day + 6) % 7) * DAY_MS);
}

/** True for a real calendar date in YYYY-MM-DD form that falls on a Monday. */
export function isWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = parseIso(value);
  return !Number.isNaN(ms) && toIso(ms) === value && new Date(ms).getUTCDay() === 1;
}

/** Members may edit the current week, plus a past week within the late-submission window. */
export function isWeekEditable(weekStart: string, now: Date = new Date()): boolean {
  return weekStart <= getWeekStart(now) && now.getTime() < editingClosesAt(weekStart).getTime();
}

/** The instant a week locks: end of the week plus the late-submission window. */
export function editingClosesAt(weekStart: string): Date {
  return new Date(parseIso(weekStart) + (7 + ALLOW_LATE_SUBMISSION_DAYS) * DAY_MS - IST_OFFSET_MS);
}

/** Last week, if it is still inside the late-submission window; otherwise null. */
export function openLateWeek(now: Date = new Date()): string | null {
  const previous = addWeeks(getWeekStart(now), -1);
  return isWeekEditable(previous, now) ? previous : null;
}

const rangeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** e.g. "20–26 Oct 2026", "27 Oct – 2 Nov 2026". */
export function formatWeekRange(weekStart: string): string {
  const start = parseIso(weekStart);
  return rangeFormat.formatRange(new Date(start), new Date(start + 6 * DAY_MS));
}

const shortFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** e.g. "19 Oct" (chart labels, titles). */
export function formatShortDate(isoDate: string): string {
  return shortFormat.format(new Date(parseIso(isoDate)));
}

/** Number of weeks from `from` to `to` (both Mondays); negative if `to` is earlier. */
export function weeksBetween(from: string, to: string): number {
  return Math.round((parseIso(to) - parseIso(from)) / (7 * DAY_MS));
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIMEZONE,
});

/** A UTC instant shown in IST, e.g. "Tue 21 Oct, 7:42 pm". */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}
