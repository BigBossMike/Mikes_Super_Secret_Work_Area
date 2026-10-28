// Plan screening: plans that read as dating, put someone down or single someone
// out are refused before anyone is asked. For 16 and 17 year olds, so are
// alcohol, vapes and drugs, and meeting at someone's home.
//
// The database has the final say (private.plan_issue in
// supabase/migrations/0007_plan_screening.sql) and the mock-up runs the same
// lists. planScreen.fixtures.json holds the test phrases all three must agree
// on. A word list can't catch everything; AI screening is the next layer.

export type PlanIssue = "dating" | "mocking" | "targeting" | "substances" | "private_place";

const RULES: { kind: PlanIssue; minorOnly: boolean; re: RegExp }[] = [
  { kind: "dating", minorOnly: false, re: /\b(dating|date night|(go|going|looking for|find me) (on )?a date|hook ?ups?|sexy|sex|nudes?|flirt(ing|y)?|girlfriend|boyfriend)\b/i },
  { kind: "mocking", minorOnly: false, re: /\b(losers?|ugly|weirdos?|freaks?|retard(s|ed)?|idiots?|stupid|dumb|laugh at|make fun of|pranks?|pranking|bully|bullies|bullying|beat (him|her|them|someone) up|get back at|teach (him|her|them) a lesson)\b/i },
  { kind: "targeting", minorOnly: false, re: /\b(the new (kid|girl|guy|boy)|from (my|our) (school|class|year|grade|work|office)|who (goes to|works at|lives (in|at|on))|lives at|(his|her|their) address)\b/i },
  { kind: "substances", minorOnly: true, re: /\b(alcohol|beers?|wine|vodka|booze|drunk|drinking|vapes?|vaping|weed|drugs?)\b/i },
  { kind: "private_place", minorOnly: true, re: /\b(my (place|house|home|room)|(your|ur) (place|house)|come over|sleep ?overs?)\b/i },
];

export const PLAN_ISSUE_MESSAGE: Record<PlanIssue, string> = {
  dating: "Intro is for plans with people, not dating. Change the wording and try again.",
  mocking: "Plans can't put anyone down. Change the wording and try again.",
  targeting: "Plans can't single anyone out. Intro picks who's asked.",
  substances: "Plans for 16 and 17 year olds can't involve alcohol, vapes or drugs.",
  private_place: "Plans for 16 and 17 year olds are in public places, not someone's home.",
};

/** What's wrong with a plan (its text, when and where together), or null if it can go out. */
export function planIssue(text: string, minor: boolean): PlanIssue | null {
  for (const r of RULES) if ((minor || !r.minorOnly) && r.re.test(text)) return r.kind;
  return null;
}
