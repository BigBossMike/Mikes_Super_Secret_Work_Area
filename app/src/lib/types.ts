export type AgeBand = "16-17" | "18+";
export type MatchStatus = "asking" | "agreed" | "passed";

export interface Person {
  id: string;
  name: string;
  lastName: string;
  age: number;
  suburb: string;
  interests: string[];
  times: string[];
  hue: number;
  /** Live: where the profile photo is stored, and a URL the app can show (lib/photos.ts). */
  photoPath?: string | null;
  photo?: string | null;
  school?: string;
  workplace?: string;
  /** Ages this person is happy to be paired with (adults). Defaults to their age ±10. */
  ageMin?: number;
  ageMax?: number;
}

export interface ObjectiveType {
  id: string;
  label: string;
  tags: string[];
  text: string;
  when: string;
  where: string;
  group: number;
}

export interface ObjectiveDraft {
  type: string;
  text: string;
  when: string;
  where: string;
  group: number;
}

export interface Objective extends ObjectiveDraft {
  month: string;
  done: boolean;
}

export interface Match {
  id: string;
  score: number;
  why: string[];
  distanceKm: number;
  status: MatchStatus;
}

export interface Seeker {
  age: number;
  suburb: string;
  interests: string[];
  times: string[];
  school?: string;
  keepSchoolOut: boolean;
  workplace?: string;
  keepWorkplaceOut?: boolean;
  ageMin?: number;
  ageMax?: number;
  /** People to never pair with, e.g. phone contacts when "hide me from my contacts" is on. */
  hiddenIds?: string[];
}
