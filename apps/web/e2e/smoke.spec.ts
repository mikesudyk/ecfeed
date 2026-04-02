import { test, expect } from "@playwright/test";

test.describe("Public browsing", () => {
  test("loads the feed page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=EC Feed")).toBeVisible();
  });

  test("shows category filter bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=All")).toBeVisible();
    await expect(page.locator("text=Dev")).toBeVisible();
    await expect(page.locator("text=AI")).toBeVisible();
  });

  test("shows sign in button for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Sign in")).toBeVisible();
  });

  test("404 page works", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.locator("text=Page not found")).toBeVisible();
  });
});
