// Meet-up check-in: picking the day and reading the time a teen types.

export interface DayOption { label: string; date: string }   // date is YYYY-MM-DD on the phone's clock

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Today, Tomorrow, then the next few days by name ("Thu 30 Oct"). */
export function dayOptions(now: Date = new Date(), count = 7): DayOption[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow"
      : d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
    return { label, date: ymd(d) };
  });
}

/**
 * "6pm", "6:30 pm", "6.30pm", "12" (noon), "18:30" -> hours and minutes.
 * 1 to 11 without am or pm is ambiguous, so it's refused.
 */
export function parseTime(text: string): { h: number; m: number } | null {
  const t = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a|p)?\s*$/i.exec(text);
  if (!t) return null;
  let h = Number(t[1]);
  const m = t[2] ? Number(t[2]) : 0;
  const ap = t[3]?.toLowerCase();
  if (m > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap.startsWith("p") && h !== 12) h += 12;
    if (ap.startsWith("a") && h === 12) h = 0;
  } else if (h > 23 || (h >= 1 && h <= 11 && t[1].length === 1)) {
    return null;
  }
  return { h, m };
}

/** The meet-up moment as an ISO timestamp, on the phone's clock. */
export function meetAt(date: string, time: { h: number; m: number }): Date {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, time.h, time.m);
}

/** "Saturday 6:30pm" */
export function meetLabel(at: Date): string {
  const day = at.toLocaleDateString("en-AU", { weekday: "long" });
  const h = at.getHours() % 12 || 12;
  return `${day} ${h}${at.getMinutes() ? ":" + String(at.getMinutes()).padStart(2, "0") : ""}${at.getHours() < 12 ? "am" : "pm"}`;
}
