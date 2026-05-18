import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApiNinjasHistoricalEventsUrl,
  buildDayInHistoryUrl,
  buildHistoryLabsDateUrl,
  buildHistoryLabsYearUrl,
  buildWikimediaOnThisDayUrl,
  buildZenQuotesDateUrl,
  cleanProviderText,
  createFallbackFact,
  fetchBattleFacts,
  fetchDailyFacts,
  fetchFactBurst,
} from "./facts";

describe("facts service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds date-first provider URLs", () => {
    expect(buildWikimediaOnThisDayUrl("events", 5, 18)).toBe(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/5/18",
    );
    expect(buildWikimediaOnThisDayUrl("births", 5, 18)).toBe(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/births/5/18",
    );
    expect(buildHistoryLabsDateUrl(5, 18)).toBe("https://events.historylabs.io/date?month=5&day=18");
    expect(buildHistoryLabsYearUrl(1969)).toBe("https://events.historylabs.io/year/1969");
    expect(buildDayInHistoryUrl(5, 18)).toBe("https://api.dayinhistory.dev/v1/date/05/18/events/");
    expect(buildZenQuotesDateUrl(5, 18)).toBe("https://today.zenquotes.io/api/05/18");
    expect(buildApiNinjasHistoricalEventsUrl(5, 18)).toBe(
      "https://api.api-ninjas.com/v1/historicalevents?month=5&day=18",
    );
  });

  it("cleans provider HTML and wiki math markup before rendering card text", () => {
    expect(cleanProviderText("<b>177</b> has {\\displaystyle 177=2^{7}+7^{2}} hidden markup.")).toBe(
      "177 has hidden markup.",
    );
  });

  it("loads date-only cards from Wikimedia, HistoryLabs, and Day in History", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("/events/5/18")) {
        return Response.json({
          events: [
            {
              year: 2019,
              text: "United States presidential election: Joe Biden launches his presidential campaign.",
            },
            {
              year: 1980,
              text: "<b>Mount St. Helens</b> erupts in Washington, reshaping the mountain.",
            },
          ],
        });
      }

      if (href.includes("/births/5/18")) {
        return Response.json({
          births: [{ year: 1872, text: "Bertrand Russell, Welsh mathematician and philosopher, is born." }],
        });
      }

      if (href.includes("events.historylabs.io/date")) {
        return Response.json({
          events: [
            {
              year: "332",
              content: "Emperor Constantine the Great announces free food distributions in Constantinople.",
            },
          ],
        });
      }

      if (href.includes("api.dayinhistory.dev")) {
        return Response.json({
          results: [
            {
              year: "2005",
              title: "Pluto moons",
              description: "Hubble images confirm two additional moons orbiting Pluto.",
            },
          ],
        });
      }

      throw new Error(`unexpected url ${href}`);
    }));

    const cards = await fetchFactBurst("05/18");

    expect(cards.map((card) => card.type)).toEqual(["event", "birth", "history", "date"]);
    expect(cards.map((card) => card.number)).toEqual(["5/18", "5/18", "5/18", "5/18"]);
    expect(cards.map((card) => card.source)).toEqual(["wikimedia", "wikimedia", "historylabs", "dayinhistory"]);
    expect(cards[0].text).toMatch(/Mount St\. Helens/i);
    expect(cards[0].text).not.toMatch(/<b>|presidential campaign|\\displaystyle|\{/i);
  });

  it("accepts compact and ISO date input as dates", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("/events/5/18")) {
        return Response.json({ events: [{ year: 1980, text: "Mount St. Helens erupts." }] });
      }

      if (href.includes("/births/5/18")) {
        return Response.json({ births: [{ year: 1872, text: "Bertrand Russell is born." }] });
      }

      if (href.includes("events.historylabs.io/date")) {
        return Response.json({ events: [{ year: "332", content: "Constantine announces food distributions." }] });
      }

      if (href.includes("api.dayinhistory.dev")) {
        return Response.json({ results: [{ year: "2005", description: "Hubble confirms Pluto moons." }] });
      }

      throw new Error(`unexpected url ${href}`);
    }));

    await expect(fetchFactBurst("518")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ number: "5/18" })]),
    );
    await expect(fetchFactBurst("2026-05-18")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ number: "5/18" })]),
    );
  });

  it("falls through to ZenQuotes when the other direct date feeds fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("today.zenquotes.io")) {
        return Response.json({
          data: {
            Events: [
              {
                text: '<a href="//en.wikipedia.org/wiki/1980">1980</a> - Mount St. Helens erupts in Washington.',
              },
            ],
          },
        });
      }

      return new Response("not here", { status: 503 });
    }));

    const cards = await fetchFactBurst("5/18");

    expect(cards.some((card) => card.source === "zenquotes")).toBe(true);
    expect(cards.map((card) => card.text).join(" ")).not.toMatch(/<a href|\\displaystyle|\{/i);
  });

  it("uses today's date for the daily mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const cards = await fetchDailyFacts("ignored", new Date("2026-05-18T12:00:00Z"));

    expect(cards[0]).toEqual(expect.objectContaining({ type: "daily", number: "5/18" }));
    expect(cards[0].text).toMatch(/Today in history/i);
  });

  it("fetches year history for the comparison mode", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("events.historylabs.io/year/1969")) {
        return Response.json({
          events: [{ date: "July 20", description: "Apollo 11 lands on the Moon." }],
        });
      }

      throw new Error(`unexpected url ${href}`);
    }));

    const facts = await fetchBattleFacts("1969");

    expect(facts).toHaveLength(2);
    expect(facts.join(" ")).toMatch(/Apollo 11|1969/i);
  });

  it("builds direct fallback cards without leaking markup", () => {
    const card = createFallbackFact("date", "5/18", "<b>May 18</b>");

    expect(card.source).toBe("fallback");
    expect(card.text).not.toMatch(/<b>/);
  });
});
