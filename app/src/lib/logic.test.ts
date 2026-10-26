import { describe, expect, it } from "vitest";
import { ageBand, ageFrom } from "./age";
import { blockedReason } from "./contactFilter";
import { OBJECTIVE_TYPES, SAMPLE_PEOPLE } from "./data";
import { findMatches } from "./matching";

const today = new Date(2026, 9, 26);
const sport = OBJECTIVE_TYPES[0];
const teen = { age: 17, suburb: "Paddington", interests: ["Football", "Music"], times: ["Saturdays"], keepSchoolOut: true };

describe("ageFrom", () => {
  it("counts birthdays correctly", () => {
    expect(ageFrom("2009-10-26", today)).toBe(17);
    expect(ageFrom("2009-10-27", today)).toBe(16);
    expect(ageFrom("2010-10-27", today)).toBe(15);
  });
  it("rejects bad or future dates", () => {
    expect(ageFrom("2009-02-30", today)).toBeNull();
    expect(ageFrom("nonsense", today)).toBeNull();
    expect(ageFrom("2030-01-01", today)).toBeNull();
  });
  it("bands ages", () => {
    expect(ageBand(16)).toBe("16-17");
    expect(ageBand(17)).toBe("16-17");
    expect(ageBand(18)).toBe("18+");
  });
});

describe("findMatches", () => {
  it("never matches a minor with an adult", () => {
    const m = findMatches(teen, sport, SAMPLE_PEOPLE);
    expect(m.length).toBe(5);
    for (const x of m) expect(SAMPLE_PEOPLE.find(p => p.id === x.id)!.age).toBeLessThan(18);
    const adult = findMatches({ ...teen, age: 30 }, sport, SAMPLE_PEOPLE);
    for (const x of adult) expect(SAMPLE_PEOPLE.find(p => p.id === x.id)!.age).toBeGreaterThanOrEqual(18);
  });
  it("keeps the seeker's school out when asked", () => {
    const pool = SAMPLE_PEOPLE.map(p => (p.id === "jordan" ? { ...p, school: "Hill State High" } : p));
    const on = findMatches({ ...teen, school: "Hill State High" }, sport, pool).map(m => m.id);
    const off = findMatches({ ...teen, school: "Hill State High", keepSchoolOut: false }, sport, pool).map(m => m.id);
    expect(on).not.toContain("jordan");
    expect(off).toContain("jordan");
  });
  it("skips excluded people and ranks by score", () => {
    const m = findMatches(teen, sport, SAMPLE_PEOPLE, ["jordan"]);
    expect(m.map(x => x.id)).not.toContain("jordan");
    for (let i = 1; i < m.length; i++) expect(m[i - 1].score).toBeGreaterThanOrEqual(m[i].score);
  });
});

describe("blockedReason", () => {
  it("blocks contact details", () => {
    expect(blockedReason("call me on 0491 570 156")).toBe("a phone number");
    expect(blockedReason("alex@example.com")).toBe("an email address");
    expect(blockedReason("I'm @alex.k")).toBe("a social handle");
    expect(blockedReason("www.mysite.com")).toBe("a link");
    expect(blockedReason("add me on snap")).toBe("a social account");
  });
  it("lets normal plans through", () => {
    expect(blockedReason("Meet at Toowong Sports Centre at 6pm Thursday?")).toBeNull();
    expect(blockedReason("I can play anywhere, keen for Tuesday")).toBeNull();
  });
});
