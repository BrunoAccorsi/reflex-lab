import { test, expect } from "@playwright/test";

const labs = [
  "Support orchestration",
  "Tool-call safety gate",
  "Opportunity scorecard",
  "Candidate-role matching",
  "Response quality audit",
  "GitHub backlog prioritization",
];

test("keeps the lab selector and workspaces usable across screen sizes", async ({
  page,
}) => {
  for (const width of [390, 768, 1024, 1280, 1512, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Support orchestration" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Evaluate lab/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width < 1024) {
      const menu = page.getByRole("button", { name: /Capability labs/ });
      const selector = page.getByRole("navigation", {
        name: "Decision experiments",
      });
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(selector).toBeHidden();
      await menu.click();
      await expect(selector).toBeVisible();
      await selector
        .getByRole("button", { name: /Tool-call safety gate/i })
        .click();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("heading", { name: "Tool-call safety gate" }),
      ).toBeVisible();
    } else {
      const expand = page.getByRole("button", {
        name: "Expand capability labs",
      });
      await expect(expand).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("navigation", { name: "Compact decision experiments" }),
      ).toBeVisible();
      if (width >= 1280) {
        const form = await page
          .getByRole("heading", { name: "Experiment state" })
          .boundingBox();
        const result = await page
          .getByRole("heading", { name: "Result workspace" })
          .boundingBox();
        expect(result!.x).toBeGreaterThan(form!.x + 250);
        expect(Math.abs(result!.y - form!.y)).toBeLessThan(40);
      }
      await expand.click();
      await expect(
        page.getByRole("navigation", { name: "Decision experiments" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Collapse capability labs" })
        .click();
      await expect(
        page.getByRole("navigation", { name: "Compact decision experiments" }),
      ).toBeVisible();
    }
  }
});

test("switches the workbench between English and Brazilian Portuguese", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Support orchestration" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Português (Brasil)" }).click();
  await expect(
    page.getByRole("heading", { name: "Orquestração de suporte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Avaliar laboratório" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(
    page.getByRole("heading", { name: "Support orchestration" }),
  ).toBeVisible();
});

test("evaluates all six capability labs and exposes typed answer evidence", async ({
  page,
}) => {
  await page.goto("/");
  for (const lab of labs) {
    await page.getByRole("button", { name: new RegExp(lab, "i") }).click();
    await expect(page.getByRole("heading", { name: lab })).toBeVisible();
    await page.getByRole("button", { name: /Evaluate lab/ }).click();
    await expect(page.getByText(/Composite signal/)).toBeVisible();
    await page.getByRole("tab", { name: "Answers" }).click();
    await expect(page.locator("details").first()).toBeVisible();
  }
});

test("ranks repeated records and policy edits do not make another provider request", async ({
  page,
}) => {
  let evaluationRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("evaluation.evaluate")) evaluationRequests += 1;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /GitHub backlog prioritization/i })
    .click();
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await expect(page.getByText("Issue priority ranking")).toBeVisible();
  await expect(
    page.getByText("500 after billing-country change"),
  ).toBeVisible();
  expect(evaluationRequests).toBe(1);
  await page.getByRole("tab", { name: "Composition" }).click();
  await page.getByLabel("Impact weight", { exact: true }).fill("0.4");
  await expect(page.getByText(/× 0.4/)).toBeVisible();
  expect(evaluationRequests).toBe(1);
});

test("compares against the previous compatible run", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await expect(page.getByText(/Composite signal/)).toBeVisible();
  const secondEvaluation = page.waitForResponse(
    (response) =>
      response.url().includes("evaluation.evaluate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await secondEvaluation;
  await expect(page.getByText(/Composite signal/)).toBeVisible();
  await page.getByRole("tab", { name: "Compare" }).click();
  await expect(page.getByText("Primary topic")).toBeVisible();
  await expect(page.getByText("+0 pts").first()).toBeVisible();
});

test("Studio keeps visual and JSON editors synchronized and saves a browser preset", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByLabel("Built-in template").selectOption("blank");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Escalation verifier");
  await page.getByRole("button", { name: "JSON" }).click();
  await expect(page.getByLabel("Experiment definition JSON")).toContainText(
    '"title": "Escalation verifier"',
  );
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(
    page
      .getByText("Preset saved locally.")
      .or(page.getByText("Custom preset created locally.")),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Escalation verifier/i }),
  ).toBeVisible();
});
