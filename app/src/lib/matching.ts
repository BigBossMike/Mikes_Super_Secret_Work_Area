import { ageBand } from "./age";
import { SUBURBS } from "./data";
import type { Match, ObjectiveType, Person, Seeker } from "./types";

export const MAX_MATCHES = 5;

export function distanceKm(a: string, b: string): number {
  const p = SUBURBS[a], q = SUBURBS[b];
  if (!p || !q) return 10;
  return Math.max(1, Math.round(Math.hypot(p[0] - q[0], p[1] - q[1])));
}

/**
 * Picks up to 5 people for an objective.
 * Rules: same age band only, never the seeker's own school when they've asked for that,
 * then score on objective fit, shared interests, free-time overlap and distance.
 */
export function findMatches(seeker: Seeker, type: ObjectiveType, pool: Person[], exclude: string[] = []): Match[] {
  const band = ageBand(seeker.age);
  return pool
    .filter(p => ageBand(p.age) === band)
    .filter(p => !exclude.includes(p.id))
    .filter(p => !(seeker.keepSchoolOut && seeker.school && p.school && p.school.toLowerCase() === seeker.school.toLowerCase()))
    .map(p => {
      const fit = p.interests.filter(i => type.tags.includes(i));
      const shared = p.interests.filter(i => seeker.interests.includes(i));
      const times = p.times.filter(t => seeker.times.includes(t));
      const dist = distanceKm(seeker.suburb, p.suburb);
      const raw = fit.length * 14 + shared.length * 9 + times.length * 6 + Math.max(0, 14 - dist * 2);
      const why: string[] = [];
      if (fit.length) why.push(`Into ${fit[0].toLowerCase()}`);
      if (shared.length) why.push(`${shared.length} shared interest${shared.length > 1 ? "s" : ""}`);
      if (times.length) why.push(`Free ${times[0] === "Weeknights" ? "weeknights" : times[0]}`);
      why.push(`${dist} km away`);
      return { id: p.id, score: Math.min(97, 52 + raw), why, distanceKm: dist, status: "asking" as const };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);
}
