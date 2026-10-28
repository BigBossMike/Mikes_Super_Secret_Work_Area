import { describe, expect, it } from "vitest";
import { dayOptions, meetAt, meetLabel, parseTime } from "./meetTime";

describe("meet-up check-in times", () => {
  it("offers today, tomorrow and the days after", () => {
    const days = dayOptions(new Date(2026, 9, 28, 15, 0));
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ label: "Today", date: "2026-10-28" });
    expect(days[1]).toEqual({ label: "Tomorrow", date: "2026-10-29" });
    expect(days[4].date).toBe("2026-11-01");
  });
  it("reads the times people type", () => {
    expect(parseTime("6pm")).toEqual({ h: 18, m: 0 });
    expect(parseTime("6:30 pm")).toEqual({ h: 18, m: 30 });
    expect(parseTime("6.30pm")).toEqual({ h: 18, m: 30 });
    expect(parseTime("10am")).toEqual({ h: 10, m: 0 });
    expect(parseTime("12pm")).toEqual({ h: 12, m: 0 });
    expect(parseTime("12am")).toEqual({ h: 0, m: 0 });
    expect(parseTime("12")).toEqual({ h: 12, m: 0 });
    expect(parseTime("18:30")).toEqual({ h: 18, m: 30 });
    expect(parseTime("09:15")).toEqual({ h: 9, m: 15 });
  });
  it("refuses what it can't be sure of", () => {
    expect(parseTime("6")).toBeNull();          // morning or evening?
    expect(parseTime("6:30")).toBeNull();
    expect(parseTime("13pm")).toBeNull();
    expect(parseTime("6:75pm")).toBeNull();
    expect(parseTime("soon")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
  it("puts the day and time together", () => {
    const at = meetAt("2026-10-31", { h: 18, m: 30 });
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 9, 31, 18, 30]);
    expect(meetLabel(at)).toBe("Saturday 6:30pm");
    expect(meetLabel(meetAt("2026-11-01", { h: 10, m: 0 }))).toBe("Sunday 10am");
  });
});
