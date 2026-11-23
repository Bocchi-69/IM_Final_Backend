/**
 * Timezone helpers for Philippine Standard Time (PST / Asia/Manila, UTC+8)
 */
export const MANILA_TIMEZONE = "Asia/Manila";

/**
 * Returns YYYY-MM-DD in Asia/Manila
 */
export function formatManilaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns YYYY-MM in Asia/Manila
 */
export function formatManilaMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

/**
 * Returns YYYY in Asia/Manila
 */
export function formatManilaYear(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
  }).format(date);
}

/**
 * Returns hour of day (0..23) in Asia/Manila
 */
export function getManilaHour(date: Date): number {
  const str = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return parseInt(str, 10) % 24;
}

/**
 * Returns day of week short name ("Sun", "Mon", ..., "Sat") in Asia/Manila
 */
export function getManilaWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIMEZONE,
    weekday: "short",
  }).format(date);
}

/**
 * Returns day of week (0 = Sun, 1 = Mon, ..., 6 = Sat) in Asia/Manila
 */
export function getManilaDayOfWeek(date: Date): number {
  const short = getManilaWeekdayShort(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? date.getDay();
}
