import type { ObjectiveType, Person } from "./types";

// Intro runs in one city at a time. Matching is city-wide, so nobody is asked
// for a suburb and distance plays no part in who is put forward.
export const CITY = "Brisbane";

export const INTERESTS = ["Football", "Cricket", "Running", "Walking", "Gym", "Dance", "Music", "Movies", "Food", "Trivia", "Gaming", "Art", "Study"];
export const TIMES = ["Weeknights", "Tuesday nights", "Saturdays", "Sundays"];
export const GROUPS = ["Just me", "Me + 1 other", "Me + 2 others", "Me + 3 others", "Me + 4 others", "Me + 5 or more"];

export const OBJECTIVE_TYPES: ObjectiveType[] = [
  { id: "dinner", label: "Dinner or coffee", tags: ["Food"], text: "Someone to join me for a midweek dinner", when: "Wednesday, 6:30pm", where: "Paddington, somewhere casual", group: 0 },
  { id: "walk", label: "Walking buddy", tags: ["Walking", "Running"], text: "A walking buddy for early mornings along the river", when: "Weekdays, 6am", where: "Toowong riverwalk", group: 0 },
  { id: "trivia", label: "Trivia team", tags: ["Trivia", "Movies", "Music"], text: "A fourth person for our Thursday pub trivia team", when: "Thursdays, 7pm", where: "Paddington", group: 3 },
  { id: "sport", label: "Sports team", tags: ["Football", "Cricket", "Running", "Gym"], text: "A fifth player for our Tuesday night five-a-side football team", when: "Tuesdays, 7pm", where: "Toowong Sports Centre", group: 4 },
  { id: "movie", label: "Movie buddy", tags: ["Movies"], text: "Someone to see a movie with on a Saturday", when: "Saturday afternoon", where: "Event Cinemas, Indooroopilly", group: 0 },
  { id: "study", label: "Study partner", tags: ["Study"], text: "A study buddy for Maths Methods before exams", when: "Weeknights", where: "State Library", group: 0 },
  { id: "gaming", label: "Gaming", tags: ["Gaming"], text: "Someone to go to a LAN night with", when: "Friday night", where: "Fortitude Valley", group: 1 },
  { id: "event", label: "Event partner", tags: ["Dance", "Music"], text: "Someone to go to the school formal with", when: "Fri 21 Nov, 6:30pm", where: "Brisbane City Hall", group: 0 },
  { id: "other", label: "Something else", tags: [], text: "", when: "", where: "", group: 0 },
];

/** The default plan type shown first: everyday teen plans for 16–17, a midweek dinner for adults. */
export const defaultTypeFor = (age: number) => (age < 18 ? "sport" : "dinner");

// Demo stand-in for "people in my phone contacts". The live app compares hashed phone numbers on the server.
export const DEMO_CONTACT_IDS = ["kai", "dave"];

// Fictional sample people for the demo build. Replaced by the database.
export const SAMPLE_PEOPLE: Person[] = [
  { id: "jordan", name: "Jordan", lastName: "Lee", age: 17, suburb: "Toowong", interests: ["Football", "Music", "Dance", "Movies"], times: ["Weeknights", "Saturdays"], hue: 152 },
  { id: "priya", name: "Priya", lastName: "Nair", age: 16, suburb: "Indooroopilly", interests: ["Study", "Movies", "Running", "Music"], times: ["Weeknights", "Sundays"], hue: 280 },
  { id: "tom", name: "Tom", lastName: "Walsh", age: 17, suburb: "New Farm", interests: ["Football", "Gym", "Gaming"], times: ["Tuesday nights", "Saturdays"], hue: 210 },
  { id: "mia", name: "Mia", lastName: "Rossi", age: 16, suburb: "Kelvin Grove", interests: ["Dance", "Music", "Movies", "Art"], times: ["Saturdays"], hue: 340 },
  { id: "lachie", name: "Lachie", lastName: "Brown", age: 17, suburb: "Spring Hill", interests: ["Football", "Cricket", "Gaming"], times: ["Tuesday nights", "Sundays"], hue: 25 },
  { id: "ava", name: "Ava", lastName: "Chen", age: 17, suburb: "Toowong", interests: ["Art", "Movies", "Study"], times: ["Weeknights"], hue: 190 },
  { id: "kai", name: "Kai", lastName: "Tupou", age: 16, suburb: "Paddington", interests: ["Football", "Gym", "Music"], times: ["Saturdays", "Tuesday nights"], hue: 100 },
  { id: "ben", name: "Ben", lastName: "Hart", age: 22, suburb: "Paddington", interests: ["Football", "Gym", "Music"], times: ["Tuesday nights"], hue: 230 },
  { id: "chloe", name: "Chloe", lastName: "Martin", age: 24, suburb: "New Farm", interests: ["Movies", "Music", "Dance"], times: ["Saturdays"], hue: 320 },
  { id: "noah", name: "Noah", lastName: "Kim", age: 19, suburb: "Kelvin Grove", interests: ["Football", "Gaming", "Study"], times: ["Weeknights"], hue: 45 },
  { id: "grace", name: "Grace", lastName: "Okafor", age: 20, suburb: "Spring Hill", interests: ["Study", "Running", "Movies"], times: ["Sundays"], hue: 260 },
  { id: "zoe", name: "Zoe", lastName: "Ward", age: 18, suburb: "Indooroopilly", interests: ["Dance", "Music", "Art"], times: ["Saturdays"], hue: 0 },
  { id: "ethan", name: "Ethan", lastName: "Ngo", age: 26, suburb: "Toowong", interests: ["Cricket", "Gym", "Movies"], times: ["Tuesday nights"], hue: 170 },
  { id: "sophie", name: "Sophie", lastName: "Grant", age: 33, suburb: "New Farm", interests: ["Food", "Walking", "Movies"], times: ["Weeknights", "Saturdays"], hue: 300 },
  { id: "raj", name: "Raj", lastName: "Patel", age: 41, suburb: "Spring Hill", interests: ["Food", "Trivia", "Cricket"], times: ["Weeknights"], hue: 35, workplace: "Riverside Engineering" },
  { id: "dave", name: "Dave", lastName: "Murray", age: 47, suburb: "Paddington", interests: ["Walking", "Trivia", "Music"], times: ["Weeknights", "Sundays"], hue: 200 },
  { id: "graham", name: "Graham", lastName: "Wells", age: 61, suburb: "Paddington", interests: ["Walking", "Food", "Trivia"], times: ["Weeknights", "Sundays"], hue: 95 },
  { id: "helen", name: "Helen", lastName: "Ross", age: 52, suburb: "New Farm", interests: ["Food", "Art", "Walking"], times: ["Weeknights"], hue: 330 },
  { id: "margaret", name: "Margaret", lastName: "Byrne", age: 58, suburb: "Toowong", interests: ["Food", "Walking", "Art"], times: ["Weeknights", "Sundays"], hue: 15 },
  { id: "lena", name: "Lena", lastName: "Fischer", age: 36, suburb: "Kelvin Grove", interests: ["Food", "Running", "Trivia"], times: ["Weeknights"], hue: 130 },
];
