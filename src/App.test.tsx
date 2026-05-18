import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("Number Lore app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the live date code as interactive digits", () => {
    render(<App />);

    expect(screen.getByLabelText(/live date code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date input/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /inspect digit/i }).length).toBeGreaterThan(2);
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("href", "https://github.com/puneetdixit200");
    expect(screen.getByText("PUNEET DIXIT")).toBeInTheDocument();
  });

  it("loads a date history burst from the main action", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(mockDateFetch));

    render(<App />);
    await user.clear(screen.getByLabelText(/date input/i));
    await user.type(screen.getByLabelText(/date input/i), "5/18");
    await user.click(screen.getByRole("button", { name: /summon history/i }));

    expect(await screen.findByText("event")).toBeInTheDocument();
    expect(screen.getAllByText(/Mount St\. Helens/i).length).toBeGreaterThan(0);
    expect(screen.getByText("birth")).toBeInTheDocument();
    expect(screen.getByText(/Bertrand Russell/i)).toBeInTheDocument();
    expect(screen.getByText("history")).toBeInTheDocument();
    expect(screen.getByText(/Constantine/i)).toBeInTheDocument();
    expect(screen.getByText("date")).toBeInTheDocument();
    expect(screen.queryByText(/<b>|\\displaystyle|\{/i)).not.toBeInTheDocument();
  });

  it("replaces cards from the previous date search", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(mockDateFetch));

    render(<App />);

    await user.clear(screen.getByLabelText(/date input/i));
    await user.type(screen.getByLabelText(/date input/i), "5/18");
    await user.click(screen.getByRole("button", { name: /summon history/i }));

    const factZone = screen.getByLabelText(/fact cards/i);
    expect((await within(factZone).findAllByText(/Mount St\. Helens/i)).length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText(/date input/i));
    await user.type(screen.getByLabelText(/date input/i), "7/20");
    await user.click(screen.getByRole("button", { name: /summon history/i }));

    expect((await within(factZone).findAllByText(/Apollo 11/i)).length).toBeGreaterThan(0);
    expect(within(factZone).queryByText(/Mount St\. Helens/i)).not.toBeInTheDocument();
  });

  it("does not reuse card keys across repeated bursts", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(mockDateFetch));

    render(<App />);

    await user.clear(screen.getByLabelText(/date input/i));
    await user.type(screen.getByLabelText(/date input/i), "5/18");
    await user.click(screen.getByRole("button", { name: /summon history/i }));
    expect((await screen.findAllByText(/Mount St\. Helens/i)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /summon history/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/fact cards/i).querySelectorAll(".fact-card")).toHaveLength(4);
    });

    expect(errorSpy.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
    errorSpy.mockRestore();
  });

  it("shows fallback date cards when all date APIs fail", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App />);
    await user.clear(screen.getByLabelText(/date input/i));
    await user.type(screen.getByLabelText(/date input/i), "5/18");
    await user.click(screen.getByRole("button", { name: /summon history/i }));

    expect((await screen.findAllByText("fallback")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5\/18/).length).toBeGreaterThan(0);
  });

  it("validates birthday mode before decoding", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /birth date/i }));
    await user.click(screen.getByRole("button", { name: /decode birthday/i }));

    expect(screen.getByText(/choose a date first/i)).toBeInTheDocument();
  });

  it("runs a year scan", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("events.historylabs.io/year/1969")) {
        return Response.json({
          events: [{ date: "July 20", description: "Apollo 11 lands on the Moon." }],
        });
      }

      return Response.json({ events: [{ date: "May 18", description: "Mount St. Helens erupts." }] });
    }));

    render(<App />);
    await user.click(screen.getByRole("button", { name: /year scan/i }));
    await user.clear(screen.getByLabelText(/first year/i));
    await user.type(screen.getByLabelText(/first year/i), "1969");
    await user.clear(screen.getByLabelText(/second year/i));
    await user.type(screen.getByLabelText(/second year/i), "1980");
    await user.click(screen.getByRole("button", { name: /compare years/i }));

    await waitFor(() => {
      expect(screen.getByText(/winner/i)).toBeInTheDocument();
    });
  });
});

async function mockDateFetch(url: string | URL | Request): Promise<Response> {
  const href = String(url);
  const isApolloDate = href.includes("/7/20") || href.includes("month=7&day=20") || href.includes("/07/20/");

  if (href.includes("/events/")) {
    return Response.json({
      events: [
        {
          year: isApolloDate ? 1969 : 1980,
          text: isApolloDate ? "Apollo 11 lands on the Moon." : "<b>Mount St. Helens</b> erupts in Washington.",
        },
      ],
    });
  }

  if (href.includes("/births/")) {
    return Response.json({
      births: [{ year: 1872, text: "Bertrand Russell, mathematician and philosopher, is born." }],
    });
  }

  if (href.includes("events.historylabs.io/date")) {
    return Response.json({
      events: [{ year: "332", content: "Emperor Constantine announces free food distributions." }],
    });
  }

  if (href.includes("api.dayinhistory.dev")) {
    return Response.json({
      results: [{ year: "2005", description: "Hubble images confirm two additional moons orbiting Pluto." }],
    });
  }

  throw new Error(`unexpected url ${href}`);
}
