import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildByabbeOnThisDayUrl,
  buildFapiHistoryUrl,
  buildNumbersApiUrl,
  buildOpenTriviaDbUrl,
  buildProxiedNumbersDateUrl,
  buildWikipediaSearchUrl,
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
    expect(buildOpenTriviaDbUrl()).toBe("https://opentdb.com/api.php?amount=1&category=19");
    expect(buildProxiedNumbersDateUrl(5, 8)).toBe("https://corsproxy.io/?https%3A%2F%2Fnumbersapi.com%2F5%2F8%2Fdate");
    expect(buildFapiHistoryUrl()).toBe("https://f-api.ir/api/facts/category/history");
    expect(buildWikimediaOnThisDayUrl(5, 8)).toBe(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/05/08",
    );
    expect(buildByabbeOnThisDayUrl(5, 8)).toBe("https://byabbe.se/on-this-day/5/8/events.json");
    expect(buildWikipediaSearchUrl("17-year")).toBe(
      "https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=search&srnamespace=0&srlimit=6&srprop=snippet&srsearch=17-year",
    );
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

      if (href.includes("opentdb.com/api.php?amount=1&category=19")) {
        return Response.json({
          response_code: 0,
          results: [
            {
              question: "Which mathematician gave his name to the constant e?",
              correct_answer: "Euler",
            },
          ],
        });
      }

      if (href.includes("f-api.ir/api/facts/category/history")) {
        return Response.json([
          {
            title: "Antikythera mechanism",
            fact: "The Antikythera mechanism used bronze gears to model astronomical cycles more than two thousand years ago.",
            verified: true,
            source: "National Archaeological Museum",
            year_discovered: -100,
            interesting_rating: 10,
          },
        ]);
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(987_654_321_098, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.type)).toEqual(["math", "trivia", "history"]);
    expect(cards.map((card) => card.source)).toEqual(["wikipedia", "opentdb", "fapi"]);
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

      if (href.includes("corsproxy.io")) {
        return new Response("2005: Hubble confirms two additional moons around Pluto.", { status: 200 });
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

  it("does not attach today's date to ordinary numbers", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("api.wikimedia.org") || href.includes("byabbe.se") || href.includes("corsproxy.io")) {
        throw new Error(`ordinary number burst should not fetch today's date: ${href}`);
      }

      throw new Error(`unexpected provider for curated 17: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(17, new Date("2026-05-18T12:00:00"));

    expect(cards.map((card) => card.type)).toEqual(["math", "trivia", "history"]);
    expect(cards.map((card) => card.number)).toEqual(["17", "17", "17"]);
    expect(cards.map((card) => card.source)).toEqual(["curated", "curated", "curated"]);
    expect(cards.map((card) => card.text).join(" ")).not.toMatch(/5\/18|May 18/i);
    expect(cards[2].text).toMatch(/cicadas|17-year|prime/i);
  });

  it("uses a date card only when the input encodes a date", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("corsproxy.io")) {
        return new Response("2005: Hubble confirms two additional moons around Pluto.", { status: 200 });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(518, new Date("2026-01-01T12:00:00"));

    expect(cards[2].type).toBe("date");
    expect(cards[2].source).toBe("corsproxy");
    expect(cards[2].number).toBe("5/18");
    expect(cards[2].text).toMatch(/Hubble|Pluto/i);
  });

  it("searches Wikipedia for number history before using computed filler", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("w/api.php") && href.includes("46+%28number%29")) {
        return Response.json({
          query: {
            search: [
              {
                title: "Forty-six",
                snippet: "46 has a cultural trail through music, sports, and old numbering systems.",
              },
            ],
          },
        });
      }

      if (href.includes("f-api.ir")) {
        throw new Error("history provider offline");
      }

      if (href.includes("Forty-six")) {
        return Response.json({
          extract:
            "Forty-six has a cultural trail through music, sports, and old numbering systems.",
        });
      }

      if (href.includes("w/api.php")) {
        return Response.json({ query: { search: [] } });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(46, new Date("2026-05-18T12:00:00"));

    expect(cards[2].type).toBe("history");
    expect(cards[2].source).toBe("wikipedia");
    expect(cards[2].number).toBe("46");
    expect(cards[2].text).toMatch(/cultural trail|numbering systems/i);
  });

  it("rejects age and crime search noise for number history", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("w/api.php") && href.includes("46+%28number%29")) {
        return Response.json({ query: { search: [] } });
      }

      if (href.includes("f-api.ir")) {
        throw new Error("history provider offline");
      }

      if (href.includes("w/api.php") && href.includes("46+math+prime")) {
        return Response.json({
          query: {
            search: [
              {
                title: "Killing of Someone",
                snippet: "The case involved a 46-year-old suspect and a crime scene.",
              },
              {
                title: "Forty-six",
                snippet: "46 has a cultural trail through music, sports, and old numbering systems.",
              },
            ],
          },
        });
      }

      if (href.includes("Forty-six")) {
        return Response.json({
          extract:
            "Forty-six has a cultural trail through music, sports, and old numbering systems.",
        });
      }

      if (href.includes("w/api.php")) {
        return Response.json({ query: { search: [] } });
      }

      throw new Error(`unexpected url ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await fetchFactBurst(46, new Date("2026-05-18T12:00:00"));

    expect(cards[2].text).toMatch(/cultural trail|numbering systems/i);
    expect(cards[2].text).not.toMatch(/killing|crime|46-year-old/i);
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

  it("uses prime structure instead of bit and hex trivia", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const cards = await fetchFactBurst(19, new Date("2026-05-18T12:00:00"));

    expect(cards[0].source).toBe("computed");
    expect(cards[1].source).toBe("computed");
    expect(cards[0].text).toMatch(/prime/i);
    expect(cards[1].text).toMatch(/prime neighbors|gap/i);
    expect(cards[1].text).not.toMatch(/bits|hex/i);
  });

  it("turns Unix timestamps into computed facts instead of provider fallback", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("corsproxy.io") || href.includes("numbersapi.com")) {
        return new Response("not here", { status: 503 });
      }

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

    const cards = await fetchFactBurst(987_654_321_098, new Date("2026-05-18T12:00:00"));

    expect(cards).toHaveLength(3);
    expect(cards.some((card) => card.source === "fallback")).toBe(true);
    expect(cards[0].text).toMatch(/987654321098/);
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

    expect(cards.map((card) => card.source)).toEqual(["curated", "curated", "curated"]);
    expect(cards[0].text).toMatch(/pronic|pseudoperfect/i);
    expect(cards[2].text).toMatch(/ASCII|asterisk/i);
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

    const cards = await fetchFactBurst(518, new Date("2026-05-18T12:00:00"));

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

      if (href.includes("corsproxy.io") || href.includes("numbersapi.com") || href.includes("api.wikimedia.org")) {
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

    const cards = await fetchFactBurst(508, new Date("2026-01-01T12:00:00"));

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
