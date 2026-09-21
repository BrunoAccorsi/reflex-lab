import { test, expect } from "@playwright/test";

test("evaluates a scenario and changes the client-only threshold", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Support-ticket triage" })).toBeVisible();
  await page.getByRole("button", { name: /Evaluate scenario/ }).click();
  await expect(page.locator("p").filter({ hasText: /^billing$/ })).toBeVisible();
  await page.getByLabel("Confidence threshold").fill("0.95");
  await expect(page.getByText("Human review recommended")).toBeVisible();
});
