import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [{ year: 1980, text: "<b>Mount St. Helens</b> erupts in Washington State." }],
      }),
    });
  });

  await page.route("https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/births/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        births: [{ year: 1872, text: "Bertrand Russell, Welsh mathematician and philosopher, is born." }],
      }),
    });
  });

  await page.route("https://events.historylabs.io/date**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [{ year: "332", content: "Emperor Constantine announces free food distributions." }],
      }),
    });
  });

  await page.route("https://api.dayinhistory.dev/v1/date/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{ year: "2005", description: "Hubble images confirm two additional moons orbiting Pluto." }],
      }),
    });
  });
});

test("loads the hero and triggers a date history burst", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Number Lore");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
  await expect(page.getByLabel(/live date code/i)).toBeVisible();
  await page.getByLabel(/date input/i).fill("5/18");
  await page.getByRole("button", { name: /summon history/i }).click();

  await expect(page.getByText("event")).toBeVisible();
  await expect(page.getByLabel("fact cards").getByText(/Mount St\. Helens/i)).toBeVisible();
  await expect(page.getByText("birth", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bertrand Russell/i)).toBeVisible();
  await expect(page.getByText("history", { exact: true })).toBeVisible();
  await expect(page.getByText(/Constantine/i)).toBeVisible();
  await expect(page.getByText(/<b>|\\displaystyle|\{/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /github/i })).toBeVisible();
  await expect(page.getByText("PUNEET DIXIT")).toBeVisible();
});

test("keeps controls usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("Date modes", { exact: true }).getByRole("button", { name: "Today", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /birth date/i }).click();
  await expect(page.getByRole("button", { name: /decode birthday/i })).toBeVisible();
});
