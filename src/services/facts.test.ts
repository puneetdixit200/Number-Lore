import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildByabbeOnThisDayUrl,
  buildNumbersApiUrl,
  buildWikimediaOnThisDayUrl,
  buildWikipediaSummaryUrl,
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

  it("builds backup provider URLs", () => {
    expect(buildWikipediaSummaryUrl("42_(number)")).toBe(
      "https://en.wikipedia.org/api/rest_v1/page/summary/42_(number)",
    );
    expect(buildWikimediaOnThisDayUrl(5, 8)).toBe(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/05/08",
    );
    expect(buildByabbeOnThisDayUrl(5, 8)).toBe("https://byabbe.se/on-this-day/5/8/events.json");
  });

  it("fetches a math, trivia, and date burst from quiet live providers first", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("7_(number)")) {
        return Response.json({ extract: "7 is the number of classical planets." });
      }

      if (href.includes("/summary/7")) {
        return Response.json({ extract: "7 is lucky in many card rooms." });
      }

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "May 18 is a date with receipts." }] });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(7, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.type)).toEqual(["math", "trivia", "date"]);
    expect(cards.map((card) => card.source)).toEqual(["wikipedia", "wikipedia", "wikimedia"]);
    expect(fetchMock).not.toHaveBeenCalledWith("https://numbersapi.com/7/math");
  });

  it("returns fallback cards when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const cards = await fetchFactBurst(13, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.some((card) => card.source === "fallback")).toBe(true);
    expect(cards[0].text).toMatch(/13/);
  });

  it("uses backup APIs before local fallback", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("numbersapi.com")) {
        return new Response("not here", { status: 404 });
      }

      if (href.includes("42_(number)")) {
        return Response.json({ extract: "42 is the natural number after 41 and before 43." });
      }

      if (href.includes("/summary/42")) {
        return Response.json({ extract: "42 is a page with stubborn cultural gravity." });
      }

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "Unix time gets a useful origin story." }] });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(42, new Date("2026-05-08T12:00:00"));

    expect(cards.map((card) => card.source)).toEqual(["wikipedia", "wikipedia", "wikimedia"]);
    expect(cards[0].text).toMatch(/natural number/);
    expect(cards[2].text).toMatch(/1970/);
  });

  it("skips weak Wikipedia disambiguation summaries", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("42_(number)")) {
        return Response.json({ extract: "42 is the natural number after 41 and before 43." });
      }

      if (href.endsWith("/summary/42")) {
        return Response.json({ extract: "42 or The 42 most commonly refers to:" });
      }

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "Unix time gets a useful origin story." }] });
      }

      return new Response("not here", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(42, new Date("2026-05-08T12:00:00"));

    expect(cards[1].text).not.toMatch(/most commonly refers to/i);
    expect(cards[1].text).toMatch(/natural number/);
  });

  it("uses the second date backup when Wikimedia fails", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("numbersapi.com") || href.includes("api.wikimedia.org")) {
        return new Response("not here", { status: 503 });
      }

      if (href.includes("byabbe.se")) {
        return Response.json({
          events: [{ year: "332", description: "Constantine announces food distributions." }],
        });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(9, new Date("2026-05-08T12:00:00"));

    expect(cards[2].source).toBe("byabbe");
    expect(cards[2].text).toMatch(/332/);
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
