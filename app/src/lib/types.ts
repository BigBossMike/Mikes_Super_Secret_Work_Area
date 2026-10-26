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
  school?: string;
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
}
