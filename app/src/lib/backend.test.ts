/// <reference types="node" />
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contactLockedKind, friendlyError, isLimitReached } from "@/backend/errors";
import type { MyMatchRow, MyRequestRow, ProfileRow } from "@/backend/types";
import { chatFromRows, guardianFromRow, hueFor, matchFromRow, requestFromRow, userFromProfile } from "@/store/liveMapping";
import { normalisePhone, phoneHash, phoneHashes } from "./phoneHash";

describe("hide me from my contacts: phone fingerprints", () => {
  it("normalises numbers the same way as private.normalise_phone", () => {
    expect(normalisePhone("0491 570 101")).toBe("+61491570101");
    expect(normalisePhone("(04) 9157-0101")).toBe("+61491570101");
    expect(normalisePhone("61491570101")).toBe("+61491570101");
    expect(normalisePhone("+61 491 570 101")).toBe("+61491570101");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
  });
  it("hashes the normalised number exactly like private.phone_hash", () => {
    const expected = createHash("sha256").update("+61491570101", "utf8").digest("hex");
    expect(phoneHash("0491 570 101")).toBe(expected);
    expect(phoneHash("+61491570101")).toBe(expected);
    expect(phoneHash("nonsense")).toBeNull();
  });
  it("de-duplicates a contact list and skips unknown formats", () => {
    expect(phoneHashes(["0491 570 101", "+61491570101", "1800 000 000", "0491570102"]).length).toBe(2);
  });
});

describe("friendly errors", () => {
  it("explains a locked contact detail", () => {
    const e = { message: "contact_details_locked", details: "a phone number", hint: "Contact details unlock once you meet and tap phones.", code: "P0001" };
    expect(contactLockedKind(e)).toBe("a phone number");
    expect(friendlyError(e)).toBe("Not sent: it looks like a phone number. Contact details unlock once you meet and tap phones.");
  });
  it("explains the monthly limit and passes the database's own messages through", () => {
    const limit = { message: "objective_limit_reached", hint: "You've used this month's free objective. Buy one more, or go unlimited.", code: "P0001" };
    expect(isLimitReached(limit)).toBe(true);
    expect(friendlyError(limit)).toMatch(/free objective/);
    expect(friendlyError({ message: "Intro is for people aged 16 and over", code: "P0001" })).toBe("Intro is for people aged 16 and over");
    expect(friendlyError(new TypeError("Network request failed"))).toMatch(/No connection/);
    expect(friendlyError(undefined)).toBe("Something went wrong. Try again.");
  });
});

const profile: ProfileRow = {
  id: "u1", first_name: "Alex", photo_url: null, suburb: "Paddington", interests: ["Football"], free_times: ["Saturdays"],
  school: "Hill State High", keep_school_out: true, workplace: null, keep_workplace_out: true, match_age_min: null, match_age_max: null,
  hide_contacts: true, discreet_notifications: false, can_be_put_forward: false, date_of_birth: "2009-03-14", verified_at: "2026-10-27T00:00:00Z", created_at: "",
};

describe("database rows to screen state", () => {
  it("maps a profile", () => {
    const u = userFromProfile(profile, "Samoan");
    expect(u.name).toBe("Alex");
    expect(u.verified).toBe(true);
    expect(u.paused).toBe(true);
    expect(u.keepSchoolOut).toBe(true);
    expect(u.background).toBe("Samoan");
    expect(u.age).toBeGreaterThanOrEqual(17);
    expect(u.photoPath).toBe(profile.photo_url);
    expect(u.photo).toBeNull();
  });
  it("maps a guardian link", () => {
    expect(guardianFromRow(null, "").status).toBe("none");
    const g = guardianFromRow({ id: "g", teen_id: "u1", guardian_id: null, relationship: "dad", invite_phone: "+61491570157", status: "pending",
      approve_objectives: true, notify_connect: false, meet_checkin: true, created_at: "", approved_at: null }, "Chris");
    expect(g).toMatchObject({ name: "Chris", rel: "Dad", status: "sent", notifyConnect: false });
  });
  it("keeps people anonymous until they agree", () => {
    const asking: MyMatchRow = { request_id: "r1", status: "asking", score: null, reasons: [], candidate_id: null, first_name: null, age: null, suburb: null, photo_url: null };
    expect(matchFromRow(asking)).toEqual({ match: { id: "r1", score: 0, why: [], status: "asking" }, person: null });
    const agreed: MyMatchRow = { ...asking, status: "agreed", score: 91, reasons: ["Both into football", "Both free Tuesday nights"], candidate_id: "c1", first_name: "Jordan", age: 17, suburb: "Toowong", photo_url: "c1/abc.jpg" };
    const m = matchFromRow(agreed);
    expect(m.match).toEqual({ id: "r1", score: 91, why: ["Both into football", "Both free Tuesday nights"], status: "agreed" });
    expect(m.person).toMatchObject({ id: "r1", name: "Jordan", age: 17, suburb: "Toowong", photoPath: "c1/abc.jpg" });
    expect(matchFromRow({ ...asking, status: "expired" }).match.status).toBe("passed");
  });
  it("maps a request to be put forward", () => {
    const r: MyRequestRow = { request_id: "r2", status: "asking", reasons: ["Both into movies"], objective_id: "o1", objective_text: "Someone to see a movie with",
      when_text: null, where_text: null, group_size: 2, requester_id: "u9", first_name: "Sam", age: 17, suburb: "Paddington", photo_url: null, created_at: "" };
    const { request, person } = requestFromRow(r);
    expect(request).toMatchObject({ id: "r2", name: "Sam", group: 2, status: "pending", why: ["Both into movies"] });
    expect(person.hue).toBe(hueFor("u9"));
    expect(requestFromRow({ ...r, status: "agreed" }).request.status).toBe("accepted");
    expect(requestFromRow({ ...r, status: "passed" }).request.status).toBe("declined");
  });
  it("builds a chat with me and them", () => {
    const c = chatFromRows([{ id: "m1", match_request_id: "r1", sender_id: "u1", body: "Hi", created_at: "" }, { id: "m2", match_request_id: "r1", sender_id: "c1", body: "Hey", created_at: "" }], "u1", "Jordan", true);
    expect(c.msgs.map(m => m.from)).toEqual(["sys", "me", "them", "sys"]);
    expect(c.connected).toBe(true);
  });
  it("gives the same colour for the same id", () => {
    expect(hueFor("abc")).toBe(hueFor("abc"));
    expect(hueFor("abc")).toBeLessThan(360);
  });
});
