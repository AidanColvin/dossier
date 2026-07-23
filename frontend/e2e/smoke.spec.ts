// smoke: every page loads, the shell nav works, and nothing 404s.
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", heading: /public company/i },
  { path: "/sectors", heading: /sector scan/i },
  { path: "/partnerships", heading: /partnership intelligence/i },
  { path: "/directory", heading: /company directory/i },
  { path: "/projects", heading: /projects/i },
];

for (const page of PAGES) {
  test(`${page.path} renders its heading`, async ({ page: browser }) => {
    const response = await browser.goto(page.path);
    expect(response?.status()).toBe(200);
    await expect(browser.locator("h1").first()).toContainText(page.heading);
  });
}

test("the shell nav reaches every engine", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Sectors", "Partnerships", "Directory", "Projects"]) {
    await page.getByRole("navigation", { name: "Engines" }).getByText(label).click();
    await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}`));
  }
});

test("legacy routes redirect instead of 404", async ({ page }) => {
  await page.goto("/records");
  // the redirect lands on the homepage, which renders its heading.
  await expect(page).toHaveURL(/\/($|\?)/);
  await expect(page.locator("h1").first()).toBeVisible();
});
