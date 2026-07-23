// the sector scan: streamed progress, the report, exports, deep links.
import { expect, test } from "@playwright/test";

test("a demo scan streams and renders the full report", async ({ page }) => {
  await page.goto("/sectors");
  await page.getByRole("button", { name: "semiconductors", exact: true }).click();
  // the demo stream replays resolved -> progress -> done with real delays.
  await expect(page.getByText(/companies profiled in/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/No pipeline backend is configured/)).toBeVisible();
  await expect(page.getByText("RECORDS BY SOURCE", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^NVIDIA$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /References/i })).toBeVisible();
});

test("a deep link auto-runs its scan", async ({ page }) => {
  await page.goto("/sectors?q=semiconductors");
  await expect(page.getByText(/companies profiled in/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator("input[aria-label='Sector to scan']"))
    .toHaveValue("semiconductors");
});

test("running a scan puts the query in the url", async ({ page }) => {
  await page.goto("/sectors");
  await page.getByRole("button", { name: "banking", exact: true }).click();
  await expect(page).toHaveURL(/\/sectors\?q=banking/);
});

test("the report offers download and save", async ({ page }) => {
  await page.goto("/sectors?q=semiconductors");
  await expect(page.getByRole("button", { name: /download report/i }))
    .toBeVisible({ timeout: 15000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download report/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sector-semiconductors.md");
});

test("a company name in the report links to its dossier", async ({ page }) => {
  await page.goto("/sectors?q=semiconductors");
  await expect(page.getByText(/companies profiled in/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: /^NVIDIA$/ }).click();
  await expect(page).toHaveURL(/\/company\/NVDA/);
});
