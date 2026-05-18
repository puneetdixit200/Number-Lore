import { describe, expect, it } from "vitest";
import {
  createRainParticles,
  extractBirthdayNumbers,
  getDailyNumber,
  getUnixTimestamp,
  sanitizeNumberInput,
  scoreBattle,
  splitDigits,
} from "./numbers";

describe("number helpers", () => {
  it("returns a Unix timestamp in whole seconds", () => {
    expect(getUnixTimestamp(new Date("1970-01-01T00:00:42.000Z"))).toBe(42);
  });

  it("splits a number-like value into digits", () => {
    expect(splitDigits("1700000000")).toEqual([
      "1",
      "7",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
    ]);
  });

  it("keeps typed numbers display-safe", () => {
    expect(sanitizeNumberInput("  12345678901234567890abc ")).toBe("123456789012");
    expect(sanitizeNumberInput("-42 is alive")).toBe("-42");
  });

  it("derives a stable daily number from the date", () => {
    expect(getDailyNumber(new Date("2026-05-18T00:00:00"))).toBe(
      getDailyNumber(new Date("2026-05-18T23:59:59")),
    );
    expect(getDailyNumber(new Date("2026-05-18T00:00:00"))).not.toBe(
      getDailyNumber(new Date("2026-05-19T00:00:00")),
    );
  });

  it("extracts date and time numbers for birthday mode", () => {
    const numbers = extractBirthdayNumbers("1990-07-14", "09:35");

    expect(numbers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "month", value: 7 }),
        expect.objectContaining({ label: "day", value: 14 }),
        expect.objectContaining({ label: "year", value: 1990 }),
        expect.objectContaining({ label: "hour", value: 9 }),
        expect.objectContaining({ label: "minute", value: 35 }),
        expect.objectContaining({ label: "date sum", value: 2011 }),
        expect.objectContaining({ label: "digit sum", value: 31 }),
      ]),
    );
  });

  it("throws on an empty birthday date", () => {
    expect(() => extractBirthdayNumbers("")).toThrow("choose a date first");
  });

  it("scores a number battle deterministically", () => {
    const result = scoreBattle(
      { value: "42", facts: ["42 is the answer", "42 is pronic"] },
      { value: "7", facts: ["7 is prime"] },
    );

    expect(result.left.score).toBeGreaterThan(result.right.score);
    expect(result.winner).toBe("left");
  });

  it("creates bounded rain particles from a source number", () => {
    const particles = createRainParticles("909", 5);

    expect(particles).toHaveLength(5);
    expect(particles.map((particle) => particle.digit)).toEqual(["9", "0", "9", "9", "0"]);
    expect(particles.every((particle) => particle.left >= 0 && particle.left <= 100)).toBe(true);
  });
});
