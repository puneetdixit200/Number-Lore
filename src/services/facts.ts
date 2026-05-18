import type { BirthdayNumber } from "../lib/numbers";
import { sanitizeNumberInput } from "../lib/numbers";

export type FactType = "math" | "trivia" | "date" | "lore" | "daily" | "birthday" | "battle";
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
const WIKIPEDIA_ACTION_API_ROOT = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_SUMMARY_ROOT = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKIMEDIA_ON_THIS_DAY_ROOT = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events";
const BYABBE_ON_THIS_DAY_ROOT = "https://byabbe.se/on-this-day";
const COMPUTABLE_INTEGER_LIMIT = 10_000_000_000;

export function buildNumbersApiUrl(request: NumbersApiRequest): string {
  if (request.kind === "date") {
    return `${API_ROOT}/${request.month}/${request.day}/date`;
  }

  return `${API_ROOT}/${request.number}/${request.kind}`;
}

export function buildWikipediaSummaryUrl(title: string): string {
  return `${WIKIPEDIA_SUMMARY_ROOT}/${title.trim().replace(/\s+/g, "_")}`;
}

export function buildWikipediaSearchUrl(search: string, limit = 6): string {
  const params = new URLSearchParams({
    origin: "*",
    action: "query",
    format: "json",
    list: "search",
    srnamespace: "0",
    srlimit: String(limit),
    srprop: "snippet",
    srsearch: search,
  });

  return `${WIKIPEDIA_ACTION_API_ROOT}?${params}`;
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

export async function fetchFactBurst(number: string | number, _date = new Date()): Promise<FactCard[]> {
  const numberText = normalizeNumber(number);
  const encodedDate = deriveDateFromNumber(numberText);
  const contextCard = encodedDate
    ? fetchDateCard(encodedDate.month, encodedDate.day, 2)
    : fetchLoreCard(numberText, 2);

  return Promise.all([
    fetchFactCard({ kind: "math", number: numberText }, "math", numberText, 0),
    fetchFactCard({ kind: "trivia", number: numberText }, "trivia", numberText, 1),
    contextCard,
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
    lore: `${numberText} has no clean story on the wire. Its digits still add to ${digitSum}.`,
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

async function fetchDateCard(month: number, day: number, index: number): Promise<FactCard> {
  try {
    const fact = await fetchDateFact(month, day);
    return createCard("date", `${month}/${day}`, fact.text, fact.source, index);
  } catch {
    return createFallbackFact("date", `${month}/${day}`, "date", index);
  }
}

async function fetchLoreCard(number: string, index: number): Promise<FactCard> {
  try {
    const fact = await fetchNumberLoreFact(number);
    return createCard("lore", number, fact.text, fact.source, index);
  } catch {
    return createFallbackFact("lore", number, "number", index);
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

async function fetchNumberLoreFact(number: string): Promise<LiveFact> {
  const localFact = getCuratedNumberFact("lore", number) ?? getComputedLoreFact(number, false);

  if (localFact) {
    return localFact;
  }

  return fetchFirstLiveFact([
    async () => ({ source: "wikipedia", text: await fetchWikipediaNumberLore(number) }),
    async () => {
      const fact = getComputedLoreFact(number, true);

      if (!fact) {
        throw new Error("no computed lore");
      }

      return fact;
    },
  ]);
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

async function fetchWikipediaNumberLore(number: string): Promise<string> {
  const queries = buildNumberLoreSearchQueries(number);
  const triedTitles = new Set<string>();

  for (const query of queries) {
    const results = await fetchWikipediaSearch(query);
    const result = selectBestWikipediaLoreResult(results, number, query);

    if (!result || triedTitles.has(result.title)) {
      continue;
    }

    triedTitles.add(result.title);

    try {
      const summary = await fetchWikipediaSummary(result.title);
      return formatWikipediaLore(result.title, summary, number);
    } catch {
      const snippet = stripHtml(result.snippet).trim();

      if (isInterestingProviderText(snippet, number)) {
        return formatWikipediaLore(result.title, snippet, number);
      }
    }
  }

  throw new Error("Wikipedia search did not find usable number lore");
}

async function fetchWikipediaSearch(search: string): Promise<WikipediaSearchResult[]> {
  const data = await fetchJson<WikipediaSearchResponse>(buildWikipediaSearchUrl(search));
  return data.query?.search ?? [];
}

async function fetchWikimediaOnThisDay(month: number, day: number): Promise<string> {
  const data = await fetchJson<WikimediaOnThisDay>(buildWikimediaOnThisDayUrl(month, day));
  const event = selectBestHistoricalEvent(data.events, (item) => item.text, (item) => item.year);

  if (!event) {
    throw new Error("Wikimedia returned no events");
  }

  return `${event.year}: ${event.text}`;
}

async function fetchByabbeOnThisDay(month: number, day: number): Promise<string> {
  const data = await fetchJson<ByabbeOnThisDay>(buildByabbeOnThisDayUrl(month, day));
  const event = selectBestHistoricalEvent(data.events, (item) => item.description, (item) => item.year);

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

function getCuratedNumberFact(kind: "math" | "trivia" | "lore", number: string): LiveFact | null {
  const facts = CURATED_NUMBER_FACTS[number];
  const text = facts?.[kind];

  return text ? { source: "curated", text } : null;
}

function getComputedNumberFact(kind: "math" | "trivia", number: string): LiveFact | null {
  const value = Number(number);

  if (!Number.isSafeInteger(value) || value < 0 || value > COMPUTABLE_INTEGER_LIMIT) {
    return null;
  }

  const insights = buildComputedInsights(value);
  const text = insights[kind === "math" ? 0 : 1] ?? insights[0];

  return text ? { source: "computed", text } : null;
}

function getComputedLoreFact(number: string, allowFiller: boolean): LiveFact | null {
  const value = Number(number);

  if (!Number.isSafeInteger(value) || value < 0 || value > COMPUTABLE_INTEGER_LIMIT) {
    return null;
  }

  const text = buildComputedLore(value, allowFiller);

  return text ? { source: "computed", text } : null;
}

function buildComputedInsights(value: number): string[] {
  const insights: string[] = [];
  const digits = String(value);
  const digitSum = sumDigits(value);
  const squareRoot = Math.sqrt(value);
  const timestampInsights = buildUnixTimestampInsights(value);

  insights.push(...timestampInsights);

  if (isPrime(value) && value > 12) {
    if (isPowerOfTwo(value + 1)) {
      const exponent = Math.log2(value + 1);
      insights.push(`${value} is a Mersenne prime: 2^${exponent} - 1. In binary, it is a clean run of ${exponent} ones.`);
    } else {
      insights.push(`${value} is prime. Trial division reaches its square root without finding a clean split.`);
    }

    const previous = findPreviousPrime(value);
    const next = findNextPrime(value);
    insights.push(`${value}'s prime neighbors are ${previous} and ${next}; the gaps are ${value - previous} and ${next - value}.`);
  }

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

  if (insights.length < 2 && value > 12) {
    const divisor = findSmallestDivisor(value);

    if (divisor) {
      insights.push(
        `${value} cracks first at ${divisor}: ${divisor} x ${value / divisor}. That is the first clean split in its factor tree.`,
      );
    } else {
      insights.push(`${value} is prime. Trial division reaches its square root without finding a clean split.`);
    }
  }

  if (insights.length < 2 && value > 12) {
    insights.push(
      `${value} takes ${value.toString(2).length} bits in binary and wears 0x${value.toString(16).toUpperCase()} in hex.`,
    );
  }

  return insights.slice(0, 2);
}

function buildComputedLore(value: number, allowFiller: boolean): string | null {
  const digits = String(value);
  const digitSum = sumDigits(value);
  const digitalRoot = digitSum === 0 ? 0 : 1 + ((digitSum - 1) % 9);

  if (digits.length > 1 && digits === [...digits].reverse().join("")) {
    return `${value} is a palindrome, so it reads the same after a mirror flip of the digit order.`;
  }

  if (isPrime(value) && value > 12) {
    if (isPowerOfTwo(value + 1)) {
      const exponent = Math.log2(value + 1);
      return `${value} belongs to the Mersenne prime line, numbers shaped as 2^p - 1; here p is ${exponent}.`;
    }

    const previous = findPreviousPrime(value);
    const next = findNextPrime(value);
    return `${value} sits between prime neighbors ${previous} and ${next}; the gaps are ${value - previous} and ${next - value}.`;
  }

  if (allowFiller && value > 12) {
    return `${value} collapses to digital root ${digitalRoot}. Keep summing its digits and that single digit survives.`;
  }

  return null;
}

function buildUnixTimestampInsights(value: number): string[] {
  const date = new Date(value * 1000);
  const year = date.getUTCFullYear();

  if (year < 2000 || year > 2100 || Number.isNaN(date.getTime())) {
    return [];
  }

  const utcStamp = date.toISOString().replace(".000Z", " UTC").replace("T", " ");
  const daysSinceEpoch = Math.floor(value / 86_400);

  return [
    `${value} is Unix time for ${utcStamp}. The giant number is a clock reading, not a random integer.`,
    `${value} sits ${daysSinceEpoch} days after 1970-01-01 UTC. Every new day adds exactly 86400.`,
  ];
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

function isPrime(value: number): boolean {
  if (!Number.isInteger(value) || value < 2) {
    return false;
  }

  if (value === 2) {
    return true;
  }

  if (value % 2 === 0) {
    return false;
  }

  const limit = Math.floor(Math.sqrt(value));

  for (let divisor = 3; divisor <= limit; divisor += 2) {
    if (value % divisor === 0) {
      return false;
    }
  }

  return true;
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && Number.isInteger(Math.log2(value));
}

function findSmallestDivisor(value: number): number | null {
  if (value < 2) {
    return null;
  }

  if (value % 2 === 0) {
    return value === 2 ? null : 2;
  }

  const limit = Math.floor(Math.sqrt(value));

  for (let divisor = 3; divisor <= limit; divisor += 2) {
    if (value % divisor === 0) {
      return divisor;
    }
  }

  return null;
}

function findPreviousPrime(value: number): number {
  for (let candidate = value - 1; candidate >= 2; candidate -= 1) {
    if (isPrime(candidate)) {
      return candidate;
    }
  }

  return 2;
}

function findNextPrime(value: number): number {
  for (let candidate = value + 1; candidate <= value + 10_000; candidate += 1) {
    if (isPrime(candidate)) {
      return candidate;
    }
  }

  return value;
}

function buildNumberLoreSearchQueries(number: string): string[] {
  return [`${number} (number)`, `${number} math prime`, `${number}-year`, `${number}-sided`, `${number} number history`];
}

function selectBestWikipediaLoreResult(
  results: WikipediaSearchResult[],
  number: string,
  query: string,
): WikipediaSearchResult | null {
  const scored = results
    .map((result, index) => ({
      result,
      index,
      score: scoreWikipediaLoreResult(result, number, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return scored[0]?.result ?? null;
}

function scoreWikipediaLoreResult(result: WikipediaSearchResult, number: string, query: string): number {
  const title = result.title.toLowerCase();
  const snippet = stripHtml(result.snippet).toLowerCase();
  const lowerNumber = number.toLowerCase();
  const haystack = `${title} ${snippet}`;
  let score = 0;

  if (GENERIC_WIKIPEDIA_TITLES.some((genericTitle) => title === genericTitle || title.startsWith(`${genericTitle} `))) {
    return -20;
  }

  if (/^(ad|bc|bce|ce) \d+$/.test(title)) {
    return -20;
  }

  if (title === `${lowerNumber} (number)`) {
    score += 26;
  }

  if (haystack.includes(`${lowerNumber}-year`) || haystack.includes(`${lowerNumber} year`)) {
    score += query.includes("-year") ? 24 : 14;
  }

  if (haystack.includes(`${lowerNumber}-sided`) || haystack.includes(`${lowerNumber} sided`)) {
    score += query.includes("-sided") ? 24 : 14;
  }

  if (haystack.includes(lowerNumber)) {
    score += 8;
  }

  if (/\b(cicada|mersenne|fermat|polygon|polyhedron|prime|atomic number|constellation|calendar|cycle)\b/.test(haystack)) {
    score += 12;
  }

  if (/\b(disambiguation|list of|index of|surname)\b/.test(title)) {
    score -= 18;
  }

  if (/\b(killing|murder|victim|crime|dismember|shooting|rape|terror|suspect)\b/.test(haystack)) {
    score -= 40;
  }

  if (/\b\d+-year-old\b/.test(haystack)) {
    score -= 34;
  }

  if (/\bfollowing\b|\bpreceding\b/.test(snippet)) {
    score -= 8;
  }

  return score;
}

function formatWikipediaLore(title: string, text: string, number: string): string {
  const summary = shortenText(text);
  const numberTitle = `${number} (number)`;

  return title === numberTitle ? summary : `${title}: ${summary}`;
}

function shortenText(text: string, limit = 230): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 2).join(" ") || clean;

  if (summary.length <= limit) {
    return summary;
  }

  return `${summary.slice(0, limit).replace(/\s+\S*$/, "")}.`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
}

function deriveDateFromNumber(number: string): { month: number; day: number } | null {
  const digits = number.replace(/\D/g, "");

  if (digits.length === 3) {
    const month = Number(digits.slice(0, 1));
    const day = Number(digits.slice(1));
    return isValidMonthDay(month, day) ? { month, day } : null;
  }

  if (digits.length === 4) {
    const month = Number(digits.slice(0, 2));
    const day = Number(digits.slice(2));
    return isValidMonthDay(month, day) ? { month, day } : null;
  }

  return null;
}

function isValidMonthDay(month: number, day: number): boolean {
  const monthLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= monthLengths[month - 1];
}

function selectBestHistoricalEvent<T>(
  events: T[] | undefined,
  getText: (event: T) => string | undefined,
  getYear: (event: T) => number | string,
): T | null {
  const candidates = (events ?? [])
    .map((event, index) => {
      const text = getText(event)?.trim();
      return text
        ? {
            event,
            index,
            score: scoreHistoricalEvent(text, getYear(event)),
            year: parseHistoricalYear(getYear(event)),
          }
        : null;
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.year !== right.year) {
      return left.year - right.year;
    }

    return left.index - right.index;
  });

  return candidates[0]?.event ?? null;
}

function scoreHistoricalEvent(text: string, year: number | string): number {
  const lower = text.toLowerCase();
  const eventYear = parseHistoricalYear(year);
  const currentYear = new Date().getFullYear();
  let score = 0;

  if (Number.isFinite(eventYear)) {
    score += Math.min(18, Math.max(0, Math.floor((currentYear - eventYear) / 20)));
  }

  if (text.length >= 72) {
    score += 3;
  }

  const rewards: Array<[RegExp, number]> = [
    [/\b(hubble|pluto|space telescope|moon|astronom|comet|eclipse|planet|supernova|meteor|asteroid)\b/, 22],
    [/\b(discover|discovers|discovered|confirm|confirms|invent|invents|invented|patent|decipher|decoded)\b/, 14],
    [/\b(first|oldest|smallest|largest|fastest|earliest|only)\b/, 10],
    [/\b(computer|internet|cipher|code|mathemat|physics|chemistry|biology|genome|nuclear|atomic)\b/, 10],
    [/\b(erupt|erupts|volcano|earthquake|tsunami|impact crater|mount st\.? helens)\b/, 9],
    [/\b(publishes|premieres|opens|founds|founded|completed|unveiled|built)\b/, 7],
    [/\b(ancient|medieval|renaissance|manuscript|archaeolog|telescope|observatory)\b/, 7],
  ];

  const penalties: Array<[RegExp, number]> = [
    [/\b(presidential campaign|election campaign|announces? (his|her|their) candidacy|launches? (his|her|their) presidential campaign)\b/, 34],
    [/\b(general election|presidential election|parliamentary election|referendum|cabinet|minister|politician)\b/, 12],
    [/\b(kills?|killed|shooting|massacre|bombing|terrorist|crashes?|landslide|die|dies|dead)\b/, 10],
    [/\b(football|baseball|basketball|cricket|soccer|cup final|league title)\b/, 6],
  ];

  for (const [pattern, points] of rewards) {
    if (pattern.test(lower)) {
      score += points;
    }
  }

  for (const [pattern, points] of penalties) {
    if (pattern.test(lower)) {
      score -= points;
    }
  }

  return score;
}

function parseHistoricalYear(year: number | string): number {
  const parsed = Number(year);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
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

interface WikipediaSearchResponse {
  query?: {
    search?: WikipediaSearchResult[];
  };
}

interface WikipediaSearchResult {
  title: string;
  snippet: string;
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

const GENERIC_WIKIPEDIA_TITLES = [
  "number",
  "mathematics",
  "history of mathematics",
  "timeline of mathematics",
  "year",
];

const CURATED_NUMBER_FACTS: Record<string, Partial<Record<"math" | "trivia" | "lore", string>>> = {
  "0": {
    math: "0 does something no counting number can do: it turns absence into a place you can calculate from.",
    trivia: "Babylonian scribes left gaps before zero got its own mark. The blank space became a character.",
  },
  "1": {
    math: "1 is the multiplicative identity. Multiply by it and the number survives untouched.",
    trivia: "The loneliest number also runs the whole counting system; every tally starts by trusting one mark.",
  },
  "2": {
    math: "2 is the only even prime. Every other even number already gave itself a divisor.",
    trivia: "2 is the first number that can make a pair, a choice, an argument, or a mirror.",
  },
  "3": {
    math: "3 is the first odd prime and the first number that can close a triangle.",
    trivia: "Three sticks because people like beginnings, middles, and endings more than clean data.",
  },
  "4": {
    math: "4 is the first square after 1: two by two, the smallest real grid.",
    trivia: "Four corners make a room feel settled; that is design psychology wearing arithmetic.",
  },
  "5": {
    math: "5 is prime, and base ten treats it like a hinge because it sits halfway to 10.",
    trivia: "Five fingers made 5 feel natural long before notation got involved.",
  },
  "6": {
    math: "6 is the first perfect number: 1 + 2 + 3 gives 6 back exactly.",
    trivia: "Six sneaks into dice, insects, snowflakes, and hexagons because symmetry likes it.",
  },
  "7": {
    math: "7 is prime and cannot tile a regular pattern in the plane; it resists the grid.",
    trivia: "7 carried luck through dice, planets, and ritual counts until it became shorthand for fate.",
  },
  "8": {
    math: "8 is 2 cubed. It is the first cube that feels like a block you can hold.",
    trivia: "Turn 8 sideways and it becomes infinity; typography did half the mythology.",
  },
  "9": {
    math: "9 is 3 squared, and its multiples keep collapsing back to 9 under digit sums.",
    trivia: "Nine sounds final because it stands one step before the decimal system rolls over.",
  },
  "10": {
    math: "10 is 2 x 5, but its power mostly comes from fingers and place value.",
    trivia: "10 feels complete because our hands trained the counting system.",
  },
  "11": {
    math: "11 is prime, and two matching digits make it look less sharp than it is.",
    trivia: "11:11 became a wish ritual because clocks accidentally invented a tiny shrine.",
  },
  "12": {
    math: "12 has too many useful divisors to stay quiet: halves, thirds, quarters, and sixths all fit.",
    trivia: "Twelve runs clocks, months, eggs, juries, and old trade because it divides neatly.",
  },
  "13": {
    math: "13 is prime, but it also starts a Fibonacci-adjacent run where superstition keeps doing the marketing.",
    trivia: "Buildings skip the 13th floor more often than math skips 13. The number did nothing wrong.",
  },
  "17": {
    math: "17 is a Fermat prime: 2^(2^2) + 1. That makes a regular 17-gon constructible with compass and straightedge.",
    trivia: "In Italy, 17 carries bad luck because XVII can be rearranged into VIXI, Latin for 'I have lived.'",
    lore: "Periodical cicadas use 13- and 17-year cycles, flooding predators with more insects than they can eat.",
  },
  "23": {
    math: "23 is prime and sits inside the birthday paradox: 23 people already gives a better-than-even birthday match.",
    trivia: "23 became conspiracy bait because humans are excellent at finding patterns after the fact.",
  },
  "42": {
    math: "42 is pronic: 6 x 7. It is also the third primary pseudoperfect number, which is a better party trick.",
    trivia: "Douglas Adams picked 42 because it sounded flat, specific, and useless. That made the joke indestructible.",
    lore: "ASCII assigns 42 to the asterisk, the little wildcard that tells old tools to match almost anything.",
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
  "314": {
    math: "314 is 100 x pi rounded down to an integer; the decimal point moved, but the circle is still there.",
    trivia: "314 became Pi Day shorthand anywhere the calendar writes March 14 as 3/14.",
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
