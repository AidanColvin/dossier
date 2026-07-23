// the board-ready report page: sections, exports, and the route in.
import { expect, test } from "@playwright/test";

test("the report renders its sections in order", async ({ page }) => {
  await page.goto("/report/NVDA");
  await expect(
    page.getByRole("heading", { name: /NVIDIA.*Company Profile/i })
  ).toBeVisible({ timeout: 15000 });

  const headings = ["Executive Summary", "What the Company Does",
                    "Financial Performance", "Key Risks", "Leadership", "Sources"];
  for (const heading of headings) {
    await expect(
      page.getByRole("heading", { name: new RegExp(heading, "i") })
    ).toBeVisible();
  }

  // the executive summary opens with money, never with a paper title.
  const summary = page.locator("section").filter({ hasText: "Executive Summary" }).first();
  await expect(summary).toContainText(/generated \$[\d.]+[BMT] in revenue/);
});

test("the financial table carries yearly columns", async ({ page }) => {
  await page.goto("/report/NVDA");
  await expect(page.getByRole("columnheader", { name: /FY2025/ }))
    .toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("cell", { name: "Revenue", exact: true })).toBeVisible();
});

test("markdown and word exports download with the right names", async ({ page }) => {
  await page.goto("/report/NVDA");
  await expect(page.getByRole("button", { name: /download markdown/i }))
    .toBeVisible({ timeout: 15000 });

  const mdPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download markdown/i }).click();
  expect((await mdPromise).suggestedFilename()).toBe("NVDA-report.md");

  const docPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download word/i }).click();
  expect((await docPromise).suggestedFilename()).toBe("NVDA-report.doc");
});

test("the company page links to the full report and back", async ({ page }) => {
  await page.goto("/company/NVDA");
  await page.getByRole("link", { name: /full report/i }).click();
  await expect(page).toHaveURL(/\/report\/NVDA/);
  await page.getByRole("link", { name: /interactive view/i }).click();
  await expect(page).toHaveURL(/\/company\/NVDA/);
});
