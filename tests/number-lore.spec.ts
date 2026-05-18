import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://numbersapi.com/**", async (route) => {
    const url = route.request().url();
    const text = url.includes("/math")
      ? "42 is a pronic number with a clean little trick."
      : url.includes("/trivia")
        ? "42 is the answer with too much cultural baggage."
        : "May 18 carries a timestamp-shaped scratch mark.";

    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: text,
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
});

test("keeps controls usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Daily number", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /birth code/i }).click();
  await expect(page.getByRole("button", { name: /decode birthday/i })).toBeVisible();
});
