import type { AgeBand } from "./types";

export const MIN_AGE = 16;

/** Whole years between a YYYY-MM-DD date of birth and `today`. Returns null for an invalid date. */
export function ageFrom(dob: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date > today) return null;
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() < mo - 1 || (today.getMonth() === mo - 1 && today.getDate() < d);
  if (beforeBirthday) age--;
  return age;
}

/** Under-18s and adults are never matched with each other. */
export const ageBand = (age: number): AgeBand => (age < 18 ? "16-17" : "18+");
export const bandLabel = (band: AgeBand) => (band === "16-17" ? "16–17" : "18+");
export const isMinor = (age: number) => age < 18;
