import type { BirthdayNumber } from "../lib/numbers";
import { sanitizeNumberInput } from "../lib/numbers";

export type FactType = "math" | "trivia" | "date" | "daily" | "birthday" | "battle";
export type FactSource = "numbersapi" | "fallback";

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

export function buildNumbersApiUrl(request: NumbersApiRequest): string {
  if (request.kind === "date") {
    return `${API_ROOT}/${request.month}/${request.day}/date`;
  }

  return `${API_ROOT}/${request.number}/${request.kind}`;
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
        const text = await fetchText(buildNumbersApiUrl({ kind: "trivia", number: numberText }));
        return createCard("birthday", numberText, `${entry.label}: ${text}`, "numbersapi", index);
      } catch {
        return createFallbackFact("birthday", numberText, entry.label, index);
      }
    }),
  );
}

export async function fetchBattleFacts(number: string | number): Promise<string[]> {
  const numberText = normalizeNumber(number);
  const requests: NumbersApiRequest[] = [
    { kind: "math", number: numberText },
    { kind: "trivia", number: numberText },
  ];

  return Promise.all(
    requests.map(async (request) => {
      try {
        return await fetchText(buildNumbersApiUrl(request));
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
    const text = await fetchText(buildNumbersApiUrl(request));
    return createCard(type, number, text, "numbersapi", index);
  } catch {
    return createFallbackFact(type, number, "number", index);
  }
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
