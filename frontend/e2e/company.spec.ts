// the company page: search to dossier, money-first lede, demo honesty.
import { expect, test } from "@playwright/test";

test("searching a company lands on its page with records", async ({ page }) => {
  await page.goto("/");
  const search = page.locator("[data-hero-search]");
  await search.fill("NVIDIA");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/company\//i);
  // sample data serves NVIDIA; the record list renders.
  await expect(page.locator(".record").first()).toBeVisible({ timeout: 15000 });
});

test("the lede opens with money when financials exist", async ({ page }) => {
  await page.goto("/company/NVDA");
  const lede = page.locator(".lede");
  await expect(lede).toBeVisible({ timeout: 15000 });
  const text = (await lede.textContent()) ?? "";
  // the money sentence leads; activity trivia never does.
  expect(text).toMatch(/generated \$[\d.]+[BMT] in revenue in FY\d{4}/);
  expect(text.indexOf("revenue")).toBeLessThan(80);
});

test("a save button offers projects on a loaded company", async ({ page }) => {
  await page.goto("/company/NVDA");
  await expect(page.getByRole("button", { name: /save to projects/i }))
    .toBeVisible({ timeout: 15000 });
});
