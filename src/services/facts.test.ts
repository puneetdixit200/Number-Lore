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
  isInterestingProviderText,
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

  it("uses live providers when local systems do not cover a number", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("987654321098_(number)")) {
        return Response.json({
          extract:
            "987654321098 is a large enough number for the app to ask live providers before trying backup text.",
        });
      }

      if (href.includes("/summary/987654321098")) {
        return Response.json({
          extract:
            "987654321098 looks like a countdown with one digit missing, which is better than boilerplate.",
        });
      }

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "May 18 is a date with receipts." }] });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(987_654_321_098, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.type)).toEqual(["math", "trivia", "date"]);
    expect(cards.map((card) => card.source)).toEqual(["wikipedia", "wikipedia", "wikimedia"]);
    expect(fetchMock).not.toHaveBeenCalledWith("https://numbersapi.com/987654321098/math");
  });

  it("rejects obvious provider boilerplate", () => {
    expect(
      isInterestingProviderText("42 (forty-two) is the natural number following 41 and preceding 43.", "42"),
    ).toBe(false);
    expect(isInterestingProviderText("42 is a pronic number: 6 times 7.", "42")).toBe(false);
    expect(
      isInterestingProviderText(
        "1729 is the Hardy-Ramanujan taxicab number, the smallest number expressible as two cubes in two ways.",
        "1729",
      ),
    ).toBe(true);
  });

  it("uses curated famous-number facts before live providers", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "Unix time gets a useful origin story." }] });
      }

      throw new Error(`number provider should not be called for curated fact: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(42, new Date("2026-05-08T12:00:00"));

    expect(cards[0].source).toBe("curated");
    expect(cards[1].source).toBe("curated");
    expect(cards[0].text).toMatch(/6 x 7|pronic/i);
    expect(cards[1].text).toMatch(/Douglas Adams/i);
    expect(fetchMock).not.toHaveBeenCalledWith("https://en.wikipedia.org/api/rest_v1/page/summary/42_(number)");
  });

  it("uses curated facts for single digit clicks", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("api.wikimedia.org")) {
        return Response.json({
          events: [{ year: 2005, text: "Hubble confirms two additional moons around Pluto." }],
        });
      }

      throw new Error(`single digit number provider should not be called: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(7, new Date("2026-05-18T12:00:00"));

    expect(cards[0].source).toBe("curated");
    expect(cards[1].source).toBe("curated");
    expect(cards[0].text).toMatch(/prime|seven/i);
    expect(cards[1].text).toMatch(/luck|ritual|dice/i);
  });

  it("computes interesting facts for ordinary numbers before using dull provider text", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "Unix time gets a useful origin story." }] });
      }

      if (href.includes("121")) {
        return Response.json({ extract: "121 is the natural number following 120 and preceding 122." });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(121, new Date("2026-05-08T12:00:00"));

    expect(cards[0].source).toBe("computed");
    expect(cards[1].source).toBe("computed");
    expect(cards[0].text).toMatch(/11 x 11|square/i);
    expect(cards[1].text).toMatch(/palindrome|mirror/i);
  });

  it("turns Unix timestamps into computed facts instead of provider fallback", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("api.wikimedia.org")) {
        return Response.json({
          events: [
            {
              year: 2005,
              text: "A second photo from the Hubble Space Telescope confirms that Pluto has two additional moons.",
            },
          ],
        });
      }

      throw new Error(`number provider should not be needed for timestamp facts: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(1_779_062_400, new Date("2026-05-18T12:00:00"));

    expect(cards[0].source).toBe("computed");
    expect(cards[1].source).toBe("computed");
    expect(cards[0].text).toMatch(/Unix time|UTC/i);
    expect(cards[1].text).toMatch(/1970|days/i);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://en.wikipedia.org/api/rest_v1/page/summary/1779062400_(number)",
    );
  });

  it("returns fallback cards when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const cards = await fetchFactBurst(13, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.some((card) => card.source === "fallback")).toBe(true);
    expect(cards[0].text).toMatch(/13/);
  });

  it("uses curated facts before live APIs for known numbers", async () => {
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

    expect(cards.map((card) => card.source)).toEqual(["curated", "curated", "wikimedia"]);
    expect(cards[0].text).toMatch(/pronic|pseudoperfect/i);
    expect(cards[2].text).toMatch(/1970/);
  });

  it("chooses stronger date events instead of the newest feed item", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("api.wikimedia.org")) {
        return Response.json({
          events: [
            {
              year: 2019,
              text: "United States presidential election: Joe Biden launches his presidential campaign.",
            },
            {
              year: 2005,
              text: "A second photo from the Hubble Space Telescope confirms that Pluto has two additional moons, Nix and Hydra.",
            },
            {
              year: 1980,
              text: "Mount St. Helens erupts in Washington, reshaping the mountain and flattening surrounding forest.",
            },
          ],
        });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(42, new Date("2026-05-18T12:00:00"));

    expect(cards[2].text).not.toMatch(/presidential campaign/i);
    expect(cards[2].text).toMatch(/Hubble|Pluto|Mount St\. Helens/i);
  });

  it("skips weak Wikipedia disambiguation summaries", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("314_(number)")) {
        return Response.json({
          extract: "314 is used as a stand-in for pi when decimal points are not welcome on old keypads.",
        });
      }

      if (href.endsWith("/summary/314")) {
        return Response.json({ extract: "314 or The 314 most commonly refers to:" });
      }

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 1970, text: "Unix time gets a useful origin story." }] });
      }

      return new Response("not here", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(314, new Date("2026-05-08T12:00:00"));

    expect(cards[1].text).not.toMatch(/most commonly refers to/i);
    expect(cards[1].text).toMatch(/pi/i);
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
