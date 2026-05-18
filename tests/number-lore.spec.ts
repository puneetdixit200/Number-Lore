import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://numbersapi.com/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "text/plain",
      body: "not here",
    });
  });

  await page.route("https://en.wikipedia.org/api/rest_v1/page/summary/**", async (route) => {
    const url = route.request().url();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extract: url.includes("42_(number)")
          ? "42 is a pronic number with a clean little trick."
          : "42 is the answer with too much cultural baggage.",
      }),
    });
  });

  await page.route("https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [{ year: 1970, text: "Unix time gets a useful origin story." }],
      }),
    });
  });
});

test("loads the hero and triggers a fact burst", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel(/live unix timestamp/i)).toBeVisible();
  await page.getByLabel(/number input/i).fill("42");
  await page.getByRole("button", { name: /summon facts/i }).click();

  await expect(page.getByText("math")).toBeVisible();
  await expect(page.getByText(/42 is a pronic number/i)).toBeVisible();
  await expect(page.getByText("wiki", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("link", { name: /github/i })).toBeVisible();
});

test("keeps controls usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Daily number", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /birth code/i }).click();
  await expect(page.getByRole("button", { name: /decode birthday/i })).toBeVisible();
});
