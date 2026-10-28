import { describe, expect, it } from "vitest";
import { isOwnPhotoPath, newPhotoPath, photoOwner } from "./photos";

const ME = "0e1755cd-c725-4d77-802f-2d4456fe053a";
const OTHER = "bcfc2608-e4cc-400a-896e-19361901ffb5";

describe("profile photo paths", () => {
  it("puts a new photo in my own folder as a jpg", () => {
    const p = newPhotoPath(ME);
    expect(p.startsWith(`${ME}/`)).toBe(true);
    expect(p.endsWith(".jpg")).toBe(true);
    expect(photoOwner(p)).toBe(ME);
    expect(newPhotoPath(ME)).not.toBe(newPhotoPath(ME));
  });
  it("knows whose photo a path is", () => {
    expect(photoOwner(`${OTHER}/abc123.jpg`)).toBe(OTHER);
    expect(isOwnPhotoPath(`${ME}/abc123.jpg`, ME)).toBe(true);
    expect(isOwnPhotoPath(`${OTHER}/abc123.jpg`, ME)).toBe(false);
  });
  it("rejects paths that aren't a folder-per-person photo", () => {
    expect(photoOwner(null)).toBeNull();
    expect(photoOwner("")).toBeNull();
    expect(photoOwner("abc.jpg")).toBeNull();
    expect(photoOwner(`${ME}/../${OTHER}/abc.jpg`)).toBeNull();
    expect(photoOwner(`${ME}/abc.exe`)).toBeNull();
    expect(photoOwner(`https://example.com/${ME}/abc.jpg`)).toBeNull();
  });
});
