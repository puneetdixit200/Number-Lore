export interface BirthdayNumber {
  label: string;
  value: number;
}

export interface BattleInput {
  value: string;
  facts: string[];
}

export interface BattleSide {
  value: string;
  score: number;
  facts: string[];
}

export interface BattleResult {
  left: BattleSide;
  right: BattleSide;
  winner: "left" | "right" | "tie";
}

export interface RainParticle {
  id: string;
  digit: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
}

export function getUnixTimestamp(date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}

export function getDateCode(date = new Date()): string {
  return `${date.getMonth() + 1}${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDateInput(date = new Date()): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function splitDigits(value: string | number): string[] {
  const digits = String(value).match(/\d/g);
  return digits?.length ? digits : ["0"];
}

export function sanitizeDateInput(value: string): string {
  return value.replace(/[^\d/-]/g, "").slice(0, 10);
}

export function sanitizeNumberInput(value: string): string {
  const trimmed = value.trim();
  const isNegative = trimmed.startsWith("-");
  const digits = trimmed.replace(/\D/g, "").slice(0, 12);

  if (!digits) {
    return "";
  }

  return isNegative ? `-${digits}` : digits;
}

export function getDailyNumber(date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const seed = year * 10000 + month * 100 + day;
  return ((seed * 2654435761) >>> 0) % 10000;
}

export function extractBirthdayNumbers(dateValue: string, timeValue = ""): BirthdayNumber[] {
  if (!dateValue) {
    throw new Error("choose a date first");
  }

  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    throw new Error("choose a valid date");
  }

  const values: BirthdayNumber[] = [
    { label: "month", value: month },
    { label: "day", value: day },
    { label: "year", value: year },
    { label: "date sum", value: year + month + day },
    {
      label: "digit sum",
      value: dateValue.replace(/\D/g, "").split("").reduce((sum, digit) => sum + Number(digit), 0),
    },
  ];

  if (timeValue) {
    const [hourText, minuteText] = timeValue.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (Number.isFinite(hour)) {
      values.push({ label: "hour", value: hour });
    }

    if (Number.isFinite(minute)) {
      values.push({ label: "minute", value: minute });
    }
  }

  return values;
}

export function scoreBattle(left: BattleInput, right: BattleInput): BattleResult {
  const leftSide = scoreSide(left);
  const rightSide = scoreSide(right);

  return {
    left: leftSide,
    right: rightSide,
    winner: leftSide.score === rightSide.score ? "tie" : leftSide.score > rightSide.score ? "left" : "right",
  };
}

export function createRainParticles(source: string, count = 42): RainParticle[] {
  const digits = splitDigits(source);

  return Array.from({ length: count }, (_, index) => {
    const seed = hashNumber(`${source}-${index}`);

    return {
      id: `rain-${source}-${index}-${seed}`,
      digit: digits[index % digits.length],
      left: seed % 101,
      delay: (seed % 900) / 1000,
      duration: 2.6 + (seed % 1800) / 1000,
      size: 0.8 + (seed % 8) / 10,
      drift: ((seed % 41) - 20) * 0.35,
    };
  });
}

function scoreSide(input: BattleInput): BattleSide {
  const valueText = sanitizeNumberInput(input.value) || "0";
  const numericValue = Math.abs(Number(valueText));
  const digitSet = new Set(splitDigits(valueText));
  const factLength = input.facts.join(" ").length;
  const variety = new Set(input.facts.flatMap((fact) => fact.toLowerCase().match(/[a-z0-9]+/g) ?? [])).size;
  const quirk =
    (isPrime(numericValue) ? 17 : 0) +
    (isPalindrome(valueText) ? 11 : 0) +
    (numericValue % 2 === 0 ? 5 : 0) +
    digitSet.size * 3;

  return {
    value: valueText,
    facts: input.facts,
    score: input.facts.length * 23 + Math.min(40, Math.floor(factLength / 8)) + Math.min(35, variety) + quirk,
  };
}

function hashNumber(value: string): number {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function isPrime(value: number): boolean {
  if (!Number.isInteger(value) || value < 2 || value > 999_999) {
    return false;
  }

  for (let divisor = 2; divisor <= Math.sqrt(value); divisor += 1) {
    if (value % divisor === 0) {
      return false;
    }
  }

  return true;
}

function isPalindrome(value: string): boolean {
  const digits = splitDigits(value).join("");
  return digits.length > 1 && digits === digits.split("").reverse().join("");
}
