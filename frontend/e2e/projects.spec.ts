// projects: save from an engine, list, reopen with no re-fetch, delete.
import { expect, test } from "@playwright/test";

test("a sector scan saves, reopens inline, and deletes", async ({ page }) => {
  await page.goto("/sectors?q=semiconductors");
  await expect(page.getByRole("button", { name: /save to projects/i }))
    .toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /save to projects/i }).click();
  await expect(page.getByRole("button", { name: /saved to projects/i })).toBeVisible();

  await page.goto("/projects");
  const entry = page.getByRole("button", { name: /semiconductors scan/i });
  await expect(entry).toBeVisible();

  // reopening renders the saved report inline, from storage, no scan re-run.
  let sectorRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/sector?")) sectorRequests += 1;
  });
  await entry.click();
  await expect(page.getByText(/companies profiled in/)).toBeVisible();
  expect(sectorRequests).toBe(0);

  await page.getByRole("button", { name: /^Delete$/ }).click();
  await expect(entry).toBeHidden();
  await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
});

test("the empty state links to every engine", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByText(/Nothing saved yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: /sector scan/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /partnership lookup/i })).toBeVisible();
});
