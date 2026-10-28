import { describe, expect, it } from "vitest";
import fixtures from "./planScreen.fixtures.json";
import { PLAN_ISSUE_MESSAGE, planIssue } from "./planScreen";

describe("plan screening", () => {
  for (const f of fixtures) {
    it(`${f.minor ? "16-17" : "adult"}: "${f.text}" -> ${f.expect ?? "allowed"}`, () => {
      expect(planIssue(f.text, f.minor)).toBe(f.expect);
    });
  }
  it("only checks alcohol and homes for 16 and 17 year olds", () => {
    expect(planIssue("Trivia and a beer at the pub", false)).toBeNull();
    expect(planIssue("Trivia and a beer at the pub", true)).toBe("substances");
    expect(planIssue("Dinner at my place", true)).toBe("private_place");
  });
  it("has a plain message for every kind, with nothing stigmatising in it", () => {
    for (const m of Object.values(PLAN_ISSUE_MESSAGE)) {
      expect(m.length).toBeGreaterThan(20);
      expect(m).not.toMatch(/lonely|struggl|find it hard|cool kids/i);
    }
  });
});
