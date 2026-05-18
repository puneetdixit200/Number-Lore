import type { BirthdayNumber } from "../lib/numbers";

export type FactType = "event" | "birth" | "death" | "holiday" | "date" | "history" | "daily" | "birthday" | "battle";
export type FactSource = "wikimedia" | "historylabs" | "dayinhistory" | "zenquotes" | "apininjas" | "computed" | "fallback";

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

type WikimediaOnThisDayType = "events" | "births" | "deaths" | "holidays" | "selected" | "all";

const WIKIMEDIA_ON_THIS_DAY_ROOT = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday";
const HISTORY_LABS_ROOT = "https://events.historylabs.io";
const DAY_IN_HISTORY_ROOT = "https://api.dayinhistory.dev/v1";
const ZEN_QUOTES_ROOT = "https://today.zenquotes.io/api";
const API_NINJAS_ROOT = "https://api.api-ninjas.com/v1/historicalevents";

export function buildWikimediaOnThisDayUrl(type: WikimediaOnThisDayType, month: number, day: number): string {
  return `${WIKIMEDIA_ON_THIS_DAY_ROOT}/${type}/${month}/${day}`;
}

export function buildHistoryLabsDateUrl(month: number, day: number): string {
  return `${HISTORY_LABS_ROOT}/date?month=${month}&day=${day}`;
}

export function buildHistoryLabsYearUrl(year: number | string): string {
  return `${HISTORY_LABS_ROOT}/year/${year}`;
}

export function buildDayInHistoryUrl(month: number, day: number): string {
  return `${DAY_IN_HISTORY_ROOT}/date/${padDatePart(month)}/${padDatePart(day)}/events/`;
}

export function buildZenQuotesDateUrl(month: number, day: number): string {
  return `${ZEN_QUOTES_ROOT}/${padDatePart(month)}/${padDatePart(day)}`;
}

export function buildApiNinjasHistoricalEventsUrl(month: number, day: number, year?: number | string): string {
  const params = new URLSearchParams({ month: String(month), day: String(day) });

  if (year) {
    params.set("year", String(year));
  }

  return `${API_NINJAS_ROOT}?${params}`;
}

export async function fetchFactBurst(rawDate: string | number, fallbackDate = new Date()): Promise<FactCard[]> {
  const dateParts = parseDateInput(rawDate, fallbackDate);

  return Promise.all([
    fetchDateProviderCard("event", dateParts, 0, [
      () => fetchWikimediaOnThisDay("events", dateParts.month, dateParts.day),
      () => fetchHistoryLabsDate(dateParts.month, dateParts.day),
      () => fetchZenQuotesDate(dateParts.month, dateParts.day),
    ]),
    fetchDateProviderCard("birth", dateParts, 1, [
      () => fetchWikimediaOnThisDay("births", dateParts.month, dateParts.day),
      () => fetchWikimediaOnThisDay("deaths", dateParts.month, dateParts.day),
      () => fetchZenQuotesDate(dateParts.month, dateParts.day),
    ]),
    fetchDateProviderCard("history", dateParts, 2, [
      () => fetchHistoryLabsDate(dateParts.month, dateParts.day),
      () => fetchDayInHistoryDate(dateParts.month, dateParts.day),
      () => fetchZenQuotesDate(dateParts.month, dateParts.day),
    ]),
    fetchDateProviderCard("date", dateParts, 3, [
      () => fetchDayInHistoryDate(dateParts.month, dateParts.day),
      () => fetchZenQuotesDate(dateParts.month, dateParts.day),
      () => fetchWikimediaOnThisDay("holidays", dateParts.month, dateParts.day),
    ]),
  ]);
}

export async function fetchDailyFacts(_ignored: string | number, date = new Date()): Promise<FactCard[]> {
  const dateParts = parseDateInput(formatDateInput(date), date);
  const label = formatDateLabel(dateParts);
  const dailyCard = createCard("daily", label, `Today in history: ${label}. The cards below stay on the date, not a random number.`, "computed", 0);
  const cards = await fetchFactBurst(label, date);

  return [dailyCard, ...cards.map((card, index) => ({ ...card, id: `daily-${card.id}-${index}` }))];
}

export async function fetchFactsForBirthday(numbers: BirthdayNumber[]): Promise<FactCard[]> {
  const month = numbers.find((entry) => entry.label.toLowerCase() === "month")?.value;
  const day = numbers.find((entry) => entry.label.toLowerCase() === "day")?.value;

  if (month && day && isValidMonthDay(month, day)) {
    const cards = await fetchFactBurst(`${month}/${day}`);
    return cards.map((card, index) => ({
      ...card,
      id: `birthday-${card.id}-${index}`,
      type: "birthday",
      text: `Birth date ${card.number}: ${card.text}`,
    }));
  }

  return [createFallbackFact("birthday", "birth date", "choose a valid month and day", 0)];
}

export async function fetchBattleFacts(year: string | number): Promise<string[]> {
  const yearText = String(year).replace(/\D/g, "").slice(0, 4) || "1969";

  try {
    const facts = await fetchHistoryLabsYear(yearText);
    return facts.length >= 2 ? facts.slice(0, 2) : [facts[0], `${yearText}: HistoryLabs had only one strong event for this year.`];
  } catch {
    return [`${yearText}: no year feed answered.`, `${yearText}: try another year with a stronger historical trail.`];
  }
}

export function createFallbackFact(type: FactType, number: string | number, label = "date", index = 0): FactCard {
  const safeLabel = cleanProviderText(label);
  const numberText = cleanProviderText(String(number || "date"));
  const textByType: Record<FactType, string> = {
    event: `${numberText}: no event feed answered cleanly yet.`,
    birth: `${numberText}: no birth or death feed answered cleanly yet.`,
    death: `${numberText}: no death feed answered cleanly yet.`,
    holiday: `${numberText}: no holiday feed answered cleanly yet.`,
    date: `${numberText}: ${safeLabel || "date feed unavailable"}.`,
    history: `${numberText}: no history feed answered cleanly yet.`,
    daily: `Today in history: ${numberText}.`,
    birthday: `${safeLabel}: ${numberText}.`,
    battle: `${numberText}: year history unavailable.`,
  };

  return createCard(type, numberText, textByType[type], "fallback", index);
}

export function cleanProviderText(value: string): string {
  const withoutDisplayMath = removeDisplayMath(value);
  const withoutTags = withoutDisplayMath.replace(/<[^>]*>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();

  return decoded;
}

async function fetchDateProviderCard(
  type: FactType,
  dateParts: DateParts,
  index: number,
  providers: Array<() => Promise<LiveFact>>,
): Promise<FactCard> {
  const label = formatDateLabel(dateParts);

  try {
    const fact = await fetchFirstLiveFact(providers);
    return createCard(type, label, fact.text, fact.source, index);
  } catch {
    return createFallbackFact(type, label, "date", index);
  }
}

async function fetchWikimediaOnThisDay(type: WikimediaOnThisDayType, month: number, day: number): Promise<LiveFact> {
  const data = await fetchJson<WikimediaOnThisDay>(buildWikimediaOnThisDayUrl(type, month, day));
  const events = getWikimediaEvents(data, type);
  const event = selectBestHistoricalEvent(events, (item) => item.text, (item) => item.year);

  if (!event?.text) {
    throw new Error("Wikimedia returned no usable date event");
  }

  return { source: "wikimedia", text: formatYearFact(event.year, event.text) };
}

async function fetchHistoryLabsDate(month: number, day: number): Promise<LiveFact> {
  const data = await fetchJson<HistoryLabsDateResponse>(buildHistoryLabsDateUrl(month, day));
  const event = selectBestHistoricalEvent(data.events, getHistoryLabsText, (item) => item.yearInt ?? item.year ?? "");
  const text = event ? getHistoryLabsText(event) : "";

  if (!event || !text) {
    throw new Error("HistoryLabs returned no usable date event");
  }

  return { source: "historylabs", text: formatYearFact(event.yearInt ?? event.year, text) };
}

async function fetchHistoryLabsYear(year: string): Promise<string[]> {
  const data = await fetchJson<HistoryLabsYearResponse>(buildHistoryLabsYearUrl(year));
  const events = (data.events ?? [])
    .map((event) => cleanProviderText(`${event.date ? `${event.date}: ` : ""}${event.description ?? event.content ?? event.text ?? ""}`))
    .filter(Boolean);

  if (!events.length) {
    throw new Error("HistoryLabs returned no year events");
  }

  return events.map((event) => `${year}: ${event}`);
}

async function fetchDayInHistoryDate(month: number, day: number): Promise<LiveFact> {
  const data = await fetchJson<DayInHistoryResponse>(buildDayInHistoryUrl(month, day));
  const events = data.events ?? data.results ?? [];
  const event = selectBestHistoricalEvent(events, getDayInHistoryText, (item) => item.year ?? "");
  const text = event ? getDayInHistoryText(event) : "";

  if (!event || !text) {
    throw new Error("Day in History returned no usable event");
  }

  return { source: "dayinhistory", text: formatYearFact(event.year, text) };
}

async function fetchZenQuotesDate(month: number, day: number): Promise<LiveFact> {
  const data = await fetchJson<ZenQuotesDateResponse>(buildZenQuotesDateUrl(month, day));
  const events = data.events ?? data.data?.Events ?? data.data?.events ?? [];
  const event = selectBestHistoricalEvent(events, getZenQuotesText, (item) => item.year ?? "");
  const text = event ? getZenQuotesText(event) : "";

  if (!event || !text) {
    throw new Error("ZenQuotes returned no usable event");
  }

  return { source: "zenquotes", text: cleanProviderText(text) };
}

async function fetchFirstLiveFact(providers: Array<() => Promise<LiveFact>>): Promise<LiveFact> {
  for (const provider of providers) {
    try {
      const fact = await provider();
      const cleanText = cleanProviderText(fact.text);

      if (cleanText.length >= 28) {
        return { source: fact.source, text: cleanText };
      }
    } catch {
      continue;
    }
  }

  throw new Error("all date providers failed");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getWikimediaEvents(data: WikimediaOnThisDay, type: WikimediaOnThisDayType): WikimediaEvent[] {
  if (type === "all") {
    return [...(data.events ?? []), ...(data.births ?? []), ...(data.deaths ?? []), ...(data.holidays ?? [])];
  }

  return data[type] ?? [];
}

function getHistoryLabsText(event: HistoryLabsEvent): string {
  return event.content ?? event.description ?? event.text ?? "";
}

function getDayInHistoryText(event: DayInHistoryEvent): string {
  return event.description ?? event.text ?? event.title ?? "";
}

function getZenQuotesText(event: ZenQuotesEvent): string {
  return event.description ?? event.text ?? event.html ?? "";
}

function formatYearFact(year: number | string | undefined, text: string): string {
  const cleanText = cleanProviderText(text);
  const yearText = year || inferLeadingYear(cleanText);

  if (!yearText || cleanText.startsWith(`${yearText}:`) || cleanText.startsWith(`${yearText} -`)) {
    return cleanText;
  }

  return `${yearText}: ${cleanText}`;
}

function inferLeadingYear(text: string): string {
  return text.match(/\b\d{3,4}\b/)?.[0] ?? "";
}

function selectBestHistoricalEvent<T>(
  events: T[] | undefined,
  getText: (event: T) => string | undefined,
  getYear: (event: T) => number | string | undefined,
): T | null {
  const candidates = (events ?? [])
    .map((event, index) => {
      const text = cleanProviderText(getText(event) ?? "");

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

function scoreHistoricalEvent(text: string, year: number | string | undefined): number {
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
    [/\b(erupt|erupts|volcano|earthquake|tsunami|impact crater|mount st\.? helens)\b/, 16],
    [/\b(publishes|premieres|opens|founds|founded|completed|unveiled|built)\b/, 7],
    [/\b(ancient|medieval|renaissance|manuscript|archaeolog|telescope|observatory)\b/, 7],
  ];

  const penalties: Array<[RegExp, number]> = [
    [/\b(presidential campaign|election campaign|announces? (his|her|their) candidacy|launches? (his|her|their) presidential campaign)\b/, 34],
    [/\b(general election|presidential election|parliamentary election|referendum|cabinet|minister|politician)\b/, 12],
    [/\b(kills?|killed|shooting|massacre|bombing|terrorist|crashes?|landslide|die|dies|dead)\b/, 8],
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

function createCard(type: FactType, number: string, text: string, source: FactSource, index: number): FactCard {
  const safeText = cleanProviderText(text);
  const seed = hashText(`${type}-${number}-${safeText}-${index}`);

  return {
    id: `${type}-${number}-${source}-${index}-${seed}`,
    type,
    number,
    text: safeText,
    source,
    angle: (seed % 36) - 18,
    offsetX: ((seed >>> 5) % 520) - 260,
    offsetY: ((seed >>> 9) % 300) - 150,
  };
}

function parseDateInput(rawDate: string | number, fallbackDate = new Date()): DateParts {
  const raw = String(rawDate ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return validOrFallback(Number(isoMatch[2]), Number(isoMatch[3]), fallbackDate);
  }

  const separatedMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})$/);

  if (separatedMatch) {
    return validOrFallback(Number(separatedMatch[1]), Number(separatedMatch[2]), fallbackDate);
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 3) {
    return validOrFallback(Number(digits.slice(0, 1)), Number(digits.slice(1)), fallbackDate);
  }

  if (digits.length === 4) {
    const firstMonth = Number(digits.slice(0, 2));
    const firstDay = Number(digits.slice(2));

    if (isValidMonthDay(firstMonth, firstDay)) {
      return { month: firstMonth, day: firstDay };
    }

    return validOrFallback(Number(digits.slice(0, 1)), Number(digits.slice(1)), fallbackDate);
  }

  return datePartsFromDate(fallbackDate);
}

function validOrFallback(month: number, day: number, fallbackDate: Date): DateParts {
  return isValidMonthDay(month, day) ? { month, day } : datePartsFromDate(fallbackDate);
}

function datePartsFromDate(date: Date): DateParts {
  return { month: date.getMonth() + 1, day: date.getDate() };
}

function formatDateInput(date: Date): string {
  const { month, day } = datePartsFromDate(date);
  return `${month}/${day}`;
}

function formatDateLabel(dateParts: DateParts): string {
  return `${dateParts.month}/${dateParts.day}`;
}

function isValidMonthDay(month: number, day: number): boolean {
  const monthLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= monthLengths[month - 1];
}

function parseHistoricalYear(year: number | string | undefined): number {
  const parsed = Number(year);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function removeDisplayMath(value: string): string {
  const marker = "{\\displaystyle";
  let output = "";
  let index = 0;

  while (index < value.length) {
    if (value.startsWith(marker, index)) {
      let depth = 0;
      let cursor = index;

      while (cursor < value.length) {
        const character = value[cursor];

        if (character === "{") {
          depth += 1;
        } else if (character === "}") {
          depth -= 1;

          if (depth === 0) {
            cursor += 1;
            break;
          }
        }

        cursor += 1;
      }

      index = cursor;
      continue;
    }

    output += value[index];
    index += 1;
  }

  return output;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, "-")
    .replace(/&hellip;/g, "...")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function hashText(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = Math.imul(31, hash) + character.charCodeAt(0);
    hash |= 0;
  }

  return hash >>> 0;
}

interface DateParts {
  month: number;
  day: number;
}

interface LiveFact {
  source: Exclude<FactSource, "fallback">;
  text: string;
}

interface WikimediaOnThisDay {
  events?: WikimediaEvent[];
  births?: WikimediaEvent[];
  deaths?: WikimediaEvent[];
  holidays?: WikimediaEvent[];
  selected?: WikimediaEvent[];
}

interface WikimediaEvent {
  year?: number | string;
  text?: string;
}

interface HistoryLabsDateResponse {
  events?: HistoryLabsEvent[];
}

interface HistoryLabsYearResponse {
  events?: Array<HistoryLabsEvent & { date?: string; description?: string }>;
}

interface HistoryLabsEvent {
  year?: number | string;
  yearInt?: number;
  content?: string;
  description?: string;
  text?: string;
}

interface DayInHistoryResponse {
  events?: DayInHistoryEvent[];
  results?: DayInHistoryEvent[];
}

interface DayInHistoryEvent {
  year?: number | string;
  title?: string;
  description?: string;
  text?: string;
}

interface ZenQuotesDateResponse {
  events?: ZenQuotesEvent[];
  data?: {
    Events?: ZenQuotesEvent[];
    events?: ZenQuotesEvent[];
  };
}

interface ZenQuotesEvent {
  year?: number | string;
  description?: string;
  text?: string;
  html?: string;
}
