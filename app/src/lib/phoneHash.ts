// "Hide me from my contacts": the app never uploads anyone's contact book.
// It uploads a fingerprint of each number, made EXACTLY the way the database
// makes it (private.normalise_phone and private.phone_hash in
// supabase/migrations/0001_init.sql). Checked in backend.test.ts.
import { sha256, toHex, utf8 } from "./sha256";

/** E.164 form, e.g. "0491 570 101" -> "+61491570101". Null if the number isn't recognised. */
export function normalisePhone(raw: string | null | undefined): string | null {
  const s = (raw ?? "").replace(/[^0-9+]/g, "");
  if (/^\+[1-9][0-9]{7,14}$/.test(s)) return s;            // already international
  if (/^0[0-9]{9}$/.test(s)) return "+61" + s.slice(1);     // Australian local
  if (/^61[0-9]{9}$/.test(s)) return "+" + s;               // Australian without the +
  return null;
}

/** Lowercase hex SHA-256 of the normalised number. Null if the number isn't recognised. */
export function phoneHash(raw: string | null | undefined): string | null {
  const n = normalisePhone(raw);
  return n ? toHex(sha256(utf8(n))) : null;
}

/** Fingerprints for a whole contact list, de-duplicated, unrecognised numbers skipped. */
export function phoneHashes(numbers: string[]): string[] {
  return [...new Set(numbers.map(phoneHash).filter((h): h is string => h !== null))];
}
