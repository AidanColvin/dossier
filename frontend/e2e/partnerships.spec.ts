// partnership intelligence: evidence cards, signals, talking points.
import { expect, test } from "@playwright/test";

test("the example lookup renders every evidence tier", async ({ page }) => {
  await page.goto("/partnerships");
  await page.getByRole("button", { name: /try NVDA \+ UNC/i }).click();

  await expect(page.getByText(/Active relationship/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: /Relationship signals/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Filings that mention it/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Co-authored research/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Trials involving both/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Funded researchers/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Talking points/i })).toBeVisible();
});

test("talking points carry strength pills and copy-all", async ({ page }) => {
  await page.goto("/partnerships?company=NVDA&institution=UNC");
  await expect(page.getByRole("heading", { name: /Talking points/i }))
    .toBeVisible({ timeout: 15000 });
  await expect(page.getByText("high").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /copy all as text/i })).toBeVisible();
});

test("a deep link auto-runs and fills both fields", async ({ page }) => {
  await page.goto("/partnerships?company=NVDA&institution=UNC");
  await expect(page.locator("input[aria-label='Company']")).toHaveValue("NVDA");
  await expect(page.locator("input[aria-label='Institution']")).toHaveValue("UNC");
  await expect(page.getByText(/Active relationship/)).toBeVisible({ timeout: 15000 });
});

test("both fields are required before a lookup fires", async ({ page }) => {
  await page.goto("/partnerships");
  await page.locator("input[aria-label='Company']").fill("NVDA");
  await page.getByRole("button", { name: /find links/i }).click();
  // nothing renders without an institution; the page stays quiet.
  await expect(page.getByText(/Active relationship/)).toBeHidden();
});
