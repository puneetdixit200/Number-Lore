import type { BirthdayNumber } from "../lib/numbers";
import { sanitizeNumberInput } from "../lib/numbers";

export type FactType = "math" | "trivia" | "date" | "daily" | "birthday" | "battle";
export type FactSource = "curated" | "computed" | "numbersapi" | "wikipedia" | "wikimedia" | "byabbe" | "fallback";

export interface FactCard {
  id: string;
  type: FactType;
  number: string;
  text: string;
  source: FactSource;
  angle: number;
  offsetX: number;
  offsetY: number;
}

export type NumbersApiRequest =
  | { kind: "math" | "trivia"; number: string | number }
  | { kind: "date"; month: number; day: number };

const API_ROOT = "https://numbersapi.com";
const WIKIPEDIA_SUMMARY_ROOT = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKIMEDIA_ON_THIS_DAY_ROOT = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events";
const BYABBE_ON_THIS_DAY_ROOT = "https://byabbe.se/on-this-day";

export function buildNumbersApiUrl(request: NumbersApiRequest): string {
  if (request.kind === "date") {
    return `${API_ROOT}/${request.month}/${request.day}/date`;
  }

  return `${API_ROOT}/${request.number}/${request.kind}`;
}

export function buildWikipediaSummaryUrl(title: string): string {
  return `${WIKIPEDIA_SUMMARY_ROOT}/${title.trim().replace(/\s+/g, "_")}`;
}

export function buildWikimediaOnThisDayUrl(month: number, day: number): string {
  return `${WIKIMEDIA_ON_THIS_DAY_ROOT}/${padDatePart(month)}/${padDatePart(day)}`;
}

export function buildByabbeOnThisDayUrl(month: number, day: number): string {
  return `${BYABBE_ON_THIS_DAY_ROOT}/${month}/${day}/events.json`;
}

export function isInterestingProviderText(text: string, number: string | number): boolean {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const numberText = String(number);

  if (clean.length < 48) {
    return false;
  }

  const dullPatterns = [
    "may refer to",
    "most commonly refers to",
    "is the natural number following",
    "is a natural number following",
    "is the integer following",
    "is an integer following",
    "is the number following",
    "following",
    "preceding",
    "is a pronic number",
  ];

  if (dullPatterns.some((pattern) => lower.includes(pattern))) {
    return false;
  }

  if (lower === numberText || lower === `${numberText}.`) {
    return false;
  }

  return true;
}

export async function fetchFactBurst(number: string | number, date = new Date()): Promise<FactCard[]> {
  const numberText = normalizeNumber(number);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return Promise.all([
    fetchFactCard({ kind: "math", number: numberText }, "math", numberText, 0),
    fetchFactCard({ kind: "trivia", number: numberText }, "trivia", numberText, 1),
    fetchFactCard({ kind: "date", month, day }, "date", `${month}/${day}`, 2),
  ]);
}

export async function fetchDailyFacts(number: string | number, date = new Date()): Promise<FactCard[]> {
  const numberText = normalizeNumber(number);
  const cards = await fetchFactBurst(numberText, date);

  return [
    createCard(
      "daily",
      numberText,
      `Daily number ${numberText}. The clock picked it; you get the evidence.`,
      "fallback",
      0,
    ),
    ...cards.map((card, index) => ({ ...card, id: `daily-${card.id}-${index}` })),
  ];
}

export async function fetchFactsForBirthday(numbers: BirthdayNumber[]): Promise<FactCard[]> {
  return Promise.all(
    numbers.map(async (entry, index) => {
      const numberText = String(entry.value);

      try {
        const fact = await fetchNumberFact("trivia", numberText);
        return createCard("birthday", numberText, `${entry.label}: ${fact.text}`, fact.source, index);
      } catch {
        return createFallbackFact("birthday", numberText, entry.label, index);
      }
    }),
  );
}

export async function fetchBattleFacts(number: string | number): Promise<string[]> {
  const numberText = normalizeNumber(number);

  return Promise.all(
    (["math", "trivia"] as const).map(async (kind) => {
      try {
        return (await fetchNumberFact(kind, numberText)).text;
      } catch {
        return createFallbackFact("battle", numberText).text;
      }
    }),
  );
}

export function createFallbackFact(type: FactType, number: string | number, label = "number", index = 0): FactCard {
  const numberText = normalizeNumber(number);
  const digitSum = numberText
    .replace(/\D/g, "")
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
  const digitCount = numberText.replace(/\D/g, "").length || 1;
  const fallbackText: Record<FactType, string> = {
    math: `${numberText} has ${digitCount} digit${digitCount === 1 ? "" : "s"} and a digit sum of ${digitSum}.`,
    trivia: `${numberText} is off the wire, so the local read is blunt: ${digitCount} digits, sum ${digitSum}.`,
    date: `${numberText} did not answer. The fallback marker stays on the calendar anyway.`,
    daily: `Daily number ${numberText}: ${digitCount} digits, digit sum ${digitSum}, no permission requested.`,
    birthday: `${label}: ${numberText}. Digit sum ${digitSum}; keep the receipt.`,
    battle: `${numberText} brings ${digitCount} digits and ${digitSum} points of raw digit weight.`,
  };

  return createCard(type, numberText, fallbackText[type], "fallback", index);
}

async function fetchFactCard(
  request: NumbersApiRequest,
  type: FactType,
  number: string,
  index: number,
): Promise<FactCard> {
  try {
    const fact = request.kind === "date" ? await fetchDateFact(request.month, request.day) : await fetchNumberFact(type, number);
    return createCard(type, number, fact.text, fact.source, index);
  } catch {
    return createFallbackFact(type, number, "number", index);
  }
}

async function fetchNumberFact(type: "math" | "trivia" | "battle" | FactType, number: string): Promise<LiveFact> {
  const kind = type === "math" ? "math" : "trivia";
  const localFact = getCuratedNumberFact(kind, number) ?? getComputedNumberFact(kind, number);

  if (localFact) {
    return localFact;
  }

  const wikipediaTitle = kind === "math" ? `${number}_(number)` : number;
  const providers: Array<() => Promise<LiveFact>> = [
    async () => ({ source: "wikipedia", text: await fetchWikipediaSummary(wikipediaTitle) }),
  ];

  if (kind === "trivia") {
    providers.push(async () => ({ source: "wikipedia", text: await fetchWikipediaSummary(`${number}_(number)`) }));
  }

  providers.push(async () => ({ source: "numbersapi", text: await fetchText(buildNumbersApiUrl({ kind, number })) }));

  return fetchFirstLiveFact(providers);
}

async function fetchDateFact(month: number, day: number): Promise<LiveFact> {
  return fetchFirstLiveFact([
    async () => ({ source: "wikimedia", text: await fetchWikimediaOnThisDay(month, day) }),
    async () => ({ source: "byabbe", text: await fetchByabbeOnThisDay(month, day) }),
    async () => ({ source: "numbersapi", text: await fetchText(buildNumbersApiUrl({ kind: "date", month, day })) }),
  ]);
}

async function fetchFirstLiveFact(providers: Array<() => Promise<LiveFact>>): Promise<LiveFact> {
  for (const provider of providers) {
    try {
      const fact = await provider();

      if (fact.text.trim()) {
        return fact;
      }
    } catch {
      continue;
    }
  }

  throw new Error("all live fact providers failed");
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Numbers API returned ${response.status}`);
  }

  const text = (await response.text()).trim();

  if (!text) {
    throw new Error("Numbers API returned empty text");
  }

  return text;
}

async function fetchWikipediaSummary(title: string): Promise<string> {
  const data = await fetchJson<WikipediaSummary>(buildWikipediaSummaryUrl(title));
  const extract = data.extract?.trim();

  if (!extract || !isInterestingProviderText(extract, title)) {
    throw new Error("Wikipedia summary did not include a usable extract");
  }

  return extract;
}

async function fetchWikimediaOnThisDay(month: number, day: number): Promise<string> {
  const data = await fetchJson<WikimediaOnThisDay>(buildWikimediaOnThisDayUrl(month, day));
  const event = data.events?.find((item) => item.text?.trim());

  if (!event) {
    throw new Error("Wikimedia returned no events");
  }

  return `${event.year}: ${event.text}`;
}

async function fetchByabbeOnThisDay(month: number, day: number): Promise<string> {
  const data = await fetchJson<ByabbeOnThisDay>(buildByabbeOnThisDayUrl(month, day));
  const event = data.events?.find((item) => item.description?.trim());

  if (!event) {
    throw new Error("Byabbe returned no events");
  }

  return `${event.year}: ${event.description}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function createCard(type: FactType, number: string, text: string, source: FactSource, index: number): FactCard {
  const seed = hashText(`${type}-${number}-${text}-${index}`);

  return {
    id: `${type}-${number}-${source}-${index}-${seed}`,
    type,
    number,
    text,
    source,
    angle: (seed % 36) - 18,
    offsetX: ((seed >>> 5) % 520) - 260,
    offsetY: ((seed >>> 9) % 300) - 150,
  };
}

function getCuratedNumberFact(kind: "math" | "trivia", number: string): LiveFact | null {
  const facts = CURATED_NUMBER_FACTS[number];
  const text = facts?.[kind];

  return text ? { source: "curated", text } : null;
}

function getComputedNumberFact(kind: "math" | "trivia", number: string): LiveFact | null {
  const value = Number(number);

  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) {
    return null;
  }

  const insights = buildComputedInsights(value);
  const text = insights[kind === "math" ? 0 : 1] ?? insights[0];

  return text ? { source: "computed", text } : null;
}

function buildComputedInsights(value: number): string[] {
  const insights: string[] = [];
  const digits = String(value);
  const digitSum = sumDigits(value);
  const squareRoot = Math.sqrt(value);

  if (Number.isInteger(squareRoot) && value > 1) {
    insights.push(`${value} is a square: ${squareRoot} x ${squareRoot}. That gives it a grid you can actually draw.`);
  }

  if (digits.length > 1 && digits === [...digits].reverse().join("")) {
    insights.push(`${value} is a palindrome. Read it from either side and it refuses to change.`);
  }

  if (isArmstrongNumber(value)) {
    insights.push(`${value} is narcissistic: its digits raised to their own count rebuild the number exactly.`);
  }

  if (isTriangular(value)) {
    const row = (Math.sqrt(8 * value + 1) - 1) / 2;
    insights.push(`${value} is triangular. Stack dots in ${row} rows and the pile lands exactly on it.`);
  }

  if (digitSum > 0 && value % digitSum === 0 && value > 9) {
    insights.push(`${value} is a Harshad number: its own digit sum, ${digitSum}, divides it cleanly.`);
  }

  if (hasRepeatedDigitRun(digits)) {
    insights.push(`${value} has a repeated-digit run. The number stutters before it moves on.`);
  }

  return insights.slice(0, 2);
}

function sumDigits(value: number): number {
  return String(Math.abs(value))
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function isArmstrongNumber(value: number): boolean {
  const digits = String(value).split("").map(Number);
  const power = digits.length;
  return digits.reduce((sum, digit) => sum + digit ** power, 0) === value && value > 9;
}

function isTriangular(value: number): boolean {
  const row = (Math.sqrt(8 * value + 1) - 1) / 2;
  return Number.isInteger(row) && value > 2;
}

function hasRepeatedDigitRun(value: string): boolean {
  return /(\d)\1{1,}/.test(value);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeNumber(number: string | number): string {
  if (typeof number === "number") {
    return String(number);
  }

  return sanitizeNumberInput(number) || number.trim() || "0";
}

function hashText(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = Math.imul(31, hash) + character.charCodeAt(0);
    hash |= 0;
  }

  return hash >>> 0;
}

interface LiveFact {
  source: Exclude<FactSource, "fallback">;
  text: string;
}

interface WikipediaSummary {
  extract?: string;
}

interface WikimediaOnThisDay {
  events?: Array<{
    year: number | string;
    text?: string;
  }>;
}

interface ByabbeOnThisDay {
  events?: Array<{
    year: number | string;
    description?: string;
  }>;
}

const CURATED_NUMBER_FACTS: Record<string, Partial<Record<"math" | "trivia", string>>> = {
  "0": {
    math: "0 does something no counting number can do: it turns absence into a place you can calculate from.",
    trivia: "Babylonian scribes left gaps before zero got its own mark. The blank space became a character.",
  },
  "1": {
    math: "1 is the multiplicative identity. Multiply by it and the number survives untouched.",
    trivia: "The loneliest number also runs the whole counting system; every tally starts by trusting one mark.",
  },
  "13": {
    math: "13 is prime, but it also starts a Fibonacci-adjacent run where superstition keeps doing the marketing.",
    trivia: "Buildings skip the 13th floor more often than math skips 13. The number did nothing wrong.",
  },
  "23": {
    math: "23 is prime and sits inside the birthday paradox: 23 people already gives a better-than-even birthday match.",
    trivia: "23 became conspiracy bait because humans are excellent at finding patterns after the fact.",
  },
  "42": {
    math: "42 is pronic: 6 x 7. It is also the third primary pseudoperfect number, which is a better party trick.",
    trivia: "Douglas Adams picked 42 because it sounded flat, specific, and useless. That made the joke indestructible.",
  },
  "69": {
    math: "69 is semiprime: 3 x 23. It looks loud, but its factorization is almost boring.",
    trivia: "69 became internet shorthand because symmetry sometimes beats subtlety.",
  },
  "100": {
    math: "100 is 10 squared, a base-ten monument. Move one digit system and the drama disappears.",
    trivia: "A perfect score feels objective until you remember someone picked the scale.",
  },
  "108": {
    math: "108 is divisible by 1, 2, 3, 4, 6, 9, 12, 18, 27, 36, 54, and 108. It travels with a large entourage.",
    trivia: "108 shows up in prayer beads, temple counts, and astronomy lore; it picked up ritual weight by repetition.",
  },
  "1729": {
    math: "1729 is the Hardy-Ramanujan taxicab number: 1^3 + 12^3 and 9^3 + 10^3 land on the same value.",
    trivia: "Hardy called 1729 dull. Ramanujan corrected him in a hospital room and made the cab number famous.",
  },
  "6174": {
    math: "6174 is Kaprekar's constant. Sort four digits high and low, subtract, repeat, and many paths fall into it.",
    trivia: "6174 feels like a trapdoor in arithmetic: ordinary four-digit numbers keep sliding toward the same room.",
  },
};
