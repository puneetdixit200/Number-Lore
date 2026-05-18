import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNumbersApiUrl,
  createFallbackFact,
  fetchBattleFacts,
  fetchFactBurst,
  fetchFactsForBirthday,
} from "./facts";

describe("facts service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds Numbers API URLs", () => {
    expect(buildNumbersApiUrl({ kind: "math", number: 42 })).toBe("https://numbersapi.com/42/math");
    expect(buildNumbersApiUrl({ kind: "trivia", number: 42 })).toBe("https://numbersapi.com/42/trivia");
    expect(buildNumbersApiUrl({ kind: "date", month: 5, day: 18 })).toBe("https://numbersapi.com/5/18/date");
  });

  it("fetches a math, trivia, and date burst", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("7 is the number of classical planets."))
      .mockResolvedValueOnce(new Response("7 is lucky in many card rooms."))
      .mockResolvedValueOnce(new Response("May 18 is a date with receipts."));
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(7, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.type)).toEqual(["math", "trivia", "date"]);
    expect(cards.every((card) => card.source === "numbersapi")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://numbersapi.com/7/math");
  });

  it("returns fallback cards when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const cards = await fetchFactBurst(13, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.some((card) => card.source === "fallback")).toBe(true);
    expect(cards[0].text).toMatch(/13/);
  });

  it("builds direct fallback cards", () => {
    const card = createFallbackFact("daily", "2026");

    expect(card.type).toBe("daily");
    expect(card.source).toBe("fallback");
    expect(card.text).toMatch(/2026/);
  });

  it("creates birthday cards for extracted values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const cards = await fetchFactsForBirthday([
      { label: "month", value: 5 },
      { label: "day", value: 18 },
    ]);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual(expect.objectContaining({ type: "birthday", number: "5" }));
    expect(cards[0].text).toMatch(/month/i);
  });

  it("fetches two facts for battle scoring", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("42 is the answer with excellent press.")),
    );

    const facts = await fetchBattleFacts("42");

    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatch(/42/);
  });
});
