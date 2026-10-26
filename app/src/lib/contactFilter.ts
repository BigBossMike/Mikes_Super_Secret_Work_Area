// Contact details are blocked in chat until two people have connected in person.
// The server runs the same check, so this is for instant feedback only.
const RULES: [RegExp, string][] = [
  [/(\+?\d[\d\s().-]{7,}\d)/, "a phone number"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "an email address"],
  [/(^|\s)@[\w.]{2,}/, "a social handle"],
  [/(https?:\/\/|www\.|\.(com|net|org|au|io|me)\b)/i, "a link"],
  [/\b(insta(gram)?|snap(chat)?|whats ?app|facebook|fb|tik ?tok|discord|my number|phone number|add me)\b/i, "a social account"],
];

/** Returns what kind of contact detail the message contains, or null if it's fine to send. */
export function blockedReason(text: string): string | null {
  for (const [re, what] of RULES) if (re.test(text)) return what;
  return null;
}
