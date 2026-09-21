import { test, expect } from "@playwright/test";

const labs = ["Support orchestration", "Tool-call safety gate", "Opportunity scorecard", "Candidate-role matching", "Response quality audit", "GitHub backlog prioritization"];

test("evaluates all six capability labs and exposes typed answer evidence", async ({ page }) => {
  await page.goto("/");
  for (const lab of labs) {
    await page.getByRole("button", { name: new RegExp(lab, "i") }).click();
    await expect(page.getByRole("heading", { name: lab })).toBeVisible();
    await page.getByRole("button", { name: /Evaluate lab/ }).click();
    await expect(page.getByText(/Composite signal/)).toBeVisible();
    await page.getByRole("button", { name: "Answers" }).click();
    await expect(page.locator("details").first()).toBeVisible();
  }
});

test("ranks repeated records and policy edits do not make another provider request", async ({ page }) => {
  let evaluationRequests = 0;
  page.on("request", (request) => { if (request.url().includes("evaluation.evaluate")) evaluationRequests += 1; });
  await page.goto("/");
  await page.getByRole("button", { name: /GitHub backlog prioritization/i }).click();
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await expect(page.getByText("Issue priority ranking")).toBeVisible();
  await expect(page.getByText("500 after billing-country change")).toBeVisible();
  expect(evaluationRequests).toBe(1);
  await page.getByRole("button", { name: "Composition" }).click();
  await page.getByLabel("Impact weight", { exact: true }).fill("0.4");
  await expect(page.getByText(/× 0.4/)).toBeVisible();
  expect(evaluationRequests).toBe(1);
});

test("compares against the previous compatible run", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Primary topic")).toBeVisible();
  await expect(page.getByText("+0 pts").first()).toBeVisible();
});

test("Studio keeps visual and JSON editors synchronized and saves a browser preset", async ({ page }) => {
  await page.goto("/studio");
  await page.getByLabel("Built-in template").selectOption("blank");
  await page.getByLabel("Title").fill("Escalation verifier");
  await page.getByRole("button", { name: "JSON" }).click();
  await expect(page.getByLabel("Experiment definition JSON")).toContainText('"title": "Escalation verifier"');
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByText("Preset saved locally.").or(page.getByText("Custom preset created locally."))).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Escalation verifier/i })).toBeVisible();
});
