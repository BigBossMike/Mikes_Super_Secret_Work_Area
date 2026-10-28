import { describe, expect, it } from "vitest";
import { routeFromData } from "./pushRoutes";

describe("where a tapped notification opens", () => {
  it("follows the screens the database sends", () => {
    for (const url of ["/home", "/requests", "/matches", "/parent-home"]) expect(routeFromData({ url })).toBe(url);
    expect(routeFromData({ url: "/chat/bcfc2608-e4cc-400a-896e-19361901ffb5" })).toBe("/chat/bcfc2608-e4cc-400a-896e-19361901ffb5");
  });
  it("ignores anything else", () => {
    expect(routeFromData(null)).toBeNull();
    expect(routeFromData({})).toBeNull();
    expect(routeFromData({ url: 42 })).toBeNull();
    expect(routeFromData({ url: "https://example.com" })).toBeNull();
    expect(routeFromData({ url: "/chat/../plans" })).toBeNull();
    expect(routeFromData({ url: "/plans" })).toBeNull();
    expect(routeFromData({ url: "/parent" })).toBeNull();
    expect(routeFromData({ url: "/home?x=1" })).toBeNull();
  });
});
