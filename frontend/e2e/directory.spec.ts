// the directory: search, filter, sort, paging controls, row links.
import { expect, test } from "@playwright/test";

test("the table renders with a count and rows", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByText(/\d+ companies/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("search narrows to a match", async ({ page }) => {
  await page.goto("/directory");
  await page.locator("input[aria-label='Search the directory']").fill("goldman");
  await expect(page.getByText("1 companies")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "GS" })).toBeVisible();
});

test("exchange pills filter the set", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "NYSE", exact: true }).click();
  await expect(page.getByText(/16 companies/)).toBeVisible({ timeout: 15000 });
});

test("clicking a header sorts and re-clicking reverses", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("columnheader", { name: /Ticker/ }).click();
  await expect(page.locator("tbody tr").first()).toContainText("AAPL", { timeout: 15000 });
  await page.getByRole("columnheader", { name: /Ticker/ }).click();
  await expect(page.locator("tbody tr").first()).toContainText("XOM", { timeout: 15000 });
});

test("a ticker opens the company dossier", async ({ page }) => {
  await page.goto("/directory");
  await page.getByRole("link", { name: "NVDA" }).click();
  await expect(page).toHaveURL(/\/company\/NVDA/);
});
