import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("Number Lore app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the live timestamp as interactive digits", () => {
    render(<App />);

    expect(screen.getByLabelText(/live unix timestamp/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /inspect digit/i }).length).toBeGreaterThan(5);
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      "https://github.com/puneetdixit200/Number-Lore",
    );
  });

  it("loads a fact burst from the main action", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const href = String(url);

      if (href.includes("42_(number)")) {
        return Response.json({ extract: "42 is a pronic number." });
      }

      if (href.includes("/summary/42")) {
        return Response.json({ extract: "42 is the answer in a famous book." });
      }

      if (href.includes("api.wikimedia.org")) {
        return Response.json({ events: [{ year: 2026, text: "May 18 kept a strange little footnote." }] });
      }

      return new Response("not here", { status: 404 });
    }));

    render(<App />);
    await user.clear(screen.getByLabelText(/number input/i));
    await user.type(screen.getByLabelText(/number input/i), "42");
    await user.click(screen.getByRole("button", { name: /summon facts/i }));

    expect(await screen.findByText("math")).toBeInTheDocument();
    expect(screen.getByText(/42 is a pronic number/i)).toBeInTheDocument();
  });

  it("shows fallback cards when the API fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<App />);
    await user.clear(screen.getByLabelText(/number input/i));
    await user.type(screen.getByLabelText(/number input/i), "13");
    await user.click(screen.getByRole("button", { name: /summon facts/i }));

    expect((await screen.findAllByText("fallback")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/13/).length).toBeGreaterThan(0);
  });

  it("validates birthday mode before decoding", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /birth code/i }));
    await user.click(screen.getByRole("button", { name: /decode birthday/i }));

    expect(screen.getByText(/choose a date first/i)).toBeInTheDocument();
  });

  it("runs a number battle", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("42 has better stories than most integers.")),
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: /number battle/i }));
    await user.clear(screen.getByLabelText(/left number/i));
    await user.type(screen.getByLabelText(/left number/i), "42");
    await user.clear(screen.getByLabelText(/right number/i));
    await user.type(screen.getByLabelText(/right number/i), "7");
    await user.click(screen.getByRole("button", { name: /fight numbers/i }));

    await waitFor(() => {
      expect(screen.getByText(/winner/i)).toBeInTheDocument();
    });
  });
});
