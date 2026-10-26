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

export const AGE_RANGE_SPREAD = 10;

/** Default ages someone is paired with: 16–17 for under-18s, otherwise their age ±10 (never under 18). */
export function defaultAgeRange(age: number): [number, number] {
  if (age < 18) return [16, 17];
  return [Math.max(18, age - AGE_RANGE_SPREAD), age + AGE_RANGE_SPREAD];
}

/** The range actually used: the person's own choice for adults, the fixed 16–17 band for under-18s. */
export function effectiveAgeRange(age: number, min?: number, max?: number): [number, number] {
  const [dMin, dMax] = defaultAgeRange(age);
  if (age < 18) return [dMin, dMax];
  const lo = Math.max(18, min ?? dMin);
  return [lo, Math.max(lo, max ?? dMax)];
}

const within = (age: number, [lo, hi]: [number, number]) => age >= lo && age <= hi;

/** Both people must fall inside each other's age range. */
export function agesCompatible(a: { age: number; ageMin?: number; ageMax?: number }, b: { age: number; ageMin?: number; ageMax?: number }) {
  return ageBand(a.age) === ageBand(b.age)
    && within(b.age, effectiveAgeRange(a.age, a.ageMin, a.ageMax))
    && within(a.age, effectiveAgeRange(b.age, b.ageMin, b.ageMax));
}
