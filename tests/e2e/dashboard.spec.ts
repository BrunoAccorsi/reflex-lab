import { test, expect } from "@playwright/test";
import { experimentDefinitionSchema } from "../../src/lib/experiments";

const labs = [
  "Support orchestration",
  "Tool-call safety gate",
  "Model selector",
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
      const compactToggle = await expand.boundingBox();
      expect(compactToggle?.width).toBeGreaterThanOrEqual(40);
      expect(compactToggle?.height).toBeGreaterThanOrEqual(40);
      await expect(
        page.getByRole("navigation", { name: "Compact decision experiments" }),
      ).toBeVisible();
      if (width >= 1280) {
        const compactNav = page.getByRole("navigation", {
          name: "Compact decision experiments",
        });
        const compactItem = await compactNav
          .getByRole("button", { name: "Support orchestration" })
          .boundingBox();
        expect(compactItem).not.toBeNull();
        expect(
          Math.abs(
            compactToggle!.x +
              compactToggle!.width / 2 -
              (compactItem!.x + compactItem!.width / 2),
          ),
        ).toBeLessThanOrEqual(1);
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
  await expect(
    page.locator('header img[alt="Jev Lab classifier mark"]'),
  ).toHaveAttribute("src", /icon\.svg/);
  await page.getByRole("button", { name: "Português (Brasil)" }).click();
  await expect(
    page.getByRole("heading", { name: "Orquestração de suporte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Avaliar laboratório" }),
  ).toBeVisible();
  await expect(page.getByLabel("Texto do chamado")).toHaveValue(
    /Fui cobrado duas vezes/,
  );
  await expect(page.getByLabel("Contexto da conta")).toHaveValue(
    /Plano Pro ativo/,
  );
  await page.getByRole("button", { name: "English" }).click();
  await expect(
    page.getByRole("heading", { name: "Support orchestration" }),
  ).toBeVisible();
  await expect(page.getByLabel("Ticket text")).toHaveValue(
    /I was charged twice/,
  );
});

test("evaluates all six capability labs and exposes typed answer evidence", async ({
  page,
}) => {
  await page.goto("/");
  for (const lab of labs) {
    await page.getByRole("button", { name: new RegExp(lab, "i") }).click();
    await expect(page.getByRole("heading", { name: lab })).toBeVisible();
    if (lab === "Model selector") {
      await expect(page.getByLabel("Prompt to route")).toHaveValue(
        /TypeScript monorepo/,
      );
      await expect(page.getByLabel("Requirements and constraints")).toHaveValue(
        /multiple tool calls/,
      );
    }
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

test("Studio state field identifiers retain focus while typing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1571, height: 900 });
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank" }).click();

  const identifier = page.getByRole("textbox", {
    name: "Field type 1 Identifier",
    exact: true,
  });
  await identifier.fill("");
  await expect(identifier).toBeFocused();
  await identifier.pressSequentially("customer_context", { delay: 30 });
  await expect(identifier).toHaveValue("customer_context");
  await expect(identifier).toBeFocused();

  await page.getByRole("button", { name: "Add field" }).click();
  const secondIdentifier = page.getByRole("textbox", {
    name: "Field type 2 Identifier",
    exact: true,
  });
  await secondIdentifier.fill("");
  await secondIdentifier.pressSequentially("account_details", { delay: 30 });
  await expect(secondIdentifier).toHaveValue("account_details");
  await expect(secondIdentifier).toBeFocused();
  await expect(identifier).toHaveValue("customer_context");

  await page
    .getByRole("button", { name: "Delete field 1", exact: true })
    .click();
  await expect(identifier).toHaveValue("account_details");
  await identifier.press("End");
  await identifier.pressSequentially("_updated", { delay: 30 });
  await expect(identifier).toHaveValue("account_details_updated");
  await expect(identifier).toBeFocused();

  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const definition = JSON.parse(
    await page.getByLabel("Experiment definition JSON").inputValue(),
  ) as { fields: { id: string }[] };
  expect(definition.fields.map((field) => field.id)).toEqual([
    "account_details_updated",
  ]);
});

test("Studio only offers run-mode choices when record fields exist", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank" }).click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Questions 1 Run mode" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Questions 1 Run mode", { exact: true }),
  ).toHaveText("Runs once");
  await expect(
    page.getByText(
      "To repeat this question, add a Records field in Definition.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yes/no", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Definition", exact: true }).click();
  await page.getByRole("button", { name: "Add field" }).click();
  const fieldId = await page
    .getByLabel("Field type 2 Identifier", { exact: true })
    .inputValue();
  await page
    .getByRole("combobox", { name: "Field type 2", exact: true })
    .selectOption("records");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  const runMode = page.getByRole("combobox", {
    name: "Questions 1 Run mode",
    exact: true,
  });
  await expect(runMode.locator("option")).toHaveCount(2);
  await runMode.selectOption(fieldId);
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  let definition = JSON.parse(
    await page.getByLabel("Experiment definition JSON").inputValue(),
  ) as {
    questions: { target: { type: string; fieldId?: string } }[];
  };
  expect(definition.questions[0].target).toEqual({ type: "records", fieldId });

  await page.getByRole("button", { name: "Definition", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete field 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(runMode).toHaveValue(fieldId);
  await expect(runMode.locator("option:checked")).toHaveText(
    `Unavailable: ${fieldId}`,
  );
  await runMode.selectOption("static");
  await expect(runMode).toHaveCount(0);
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  definition = JSON.parse(
    await page.getByLabel("Experiment definition JSON").inputValue(),
  ) as typeof definition;
  expect(definition.questions[0].target).toEqual({ type: "static" });

  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Português (Brasil)" }).click();
  await expect(
    page.getByLabel("Perguntas 1 Modo de execução", { exact: true }),
  ).toHaveText("Executa uma vez");
  await expect(
    page.getByRole("button", { name: "Sim/não", exact: true }),
  ).toBeVisible();
});

test("Studio simplifies metric sources and exposes choice values", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank" }).click();
  await page.getByRole("button", { name: "Policy", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Source question 1" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Source question 1", { exact: true }),
  ).toHaveText("Is the proposition supported?");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Yes/no", exact: true }).click();
  await page.getByRole("button", { name: "Policy", exact: true }).click();
  const source = page.getByRole("combobox", {
    name: "Source question 1",
    exact: true,
  });
  await expect(source.locator("option")).toHaveCount(2);
  await source.selectOption({ label: "New yes/no check" });
  const sourceId = await source.inputValue();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const definition = JSON.parse(
    await page.getByLabel("Experiment definition JSON").inputValue(),
  ) as {
    policy: { metrics: { source: { questionId: string } }[] };
  };
  expect(definition.policy.metrics[0].source.questionId).toBe(sourceId);
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Delete question New yes/no check",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Policy", exact: true }).click();
  await expect(source.locator("option:checked")).toHaveText(
    `Unavailable: ${sourceId}`,
  );
  await source.selectOption("supported");
  await expect(source).toHaveCount(0);

  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Delete question Is the proposition supported?",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Policy", exact: true }).click();
  await expect(
    page.getByText("Add a question in Questions to choose a source."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Source question 1", { exact: true }),
  ).toHaveText("Unavailable: supported");

  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Choice", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "New choice Option value 1",
      exact: true,
    }),
  ).toHaveValue("optionA");
  await expect(
    page.getByRole("textbox", {
      name: "New choice optionA Criteria",
      exact: true,
    }),
  ).toHaveValue("Evidence supports option A.");
  await expect(page.locator("input[readonly]")).toHaveCount(0);
});

test("Studio adds, edits, removes, and saves choice options within the limits", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank", exact: true }).click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Choice", exact: true }).click();
  const add = page.getByRole("button", {
    name: "New choice Add option",
    exact: true,
  });
  const remove = page.getByRole("button", { name: /New choice Delete option/ });
  await expect(remove).toHaveCount(2);
  await expect(remove.first()).toBeDisabled();
  await add.click();
  const criterion = page.getByRole("textbox", {
    name: "New choice optionC Criteria",
    exact: true,
  });
  await criterion.fill("");
  await criterion.pressSequentially("Account changes", { delay: 20 });
  await expect(criterion).toHaveValue("Account changes");
  await expect(criterion).toBeFocused();
  for (let count = 3; count < 12; count += 1) await add.click();
  await expect(add).toBeDisabled();
  await expect(remove).toHaveCount(12);
  await page
    .getByRole("button", {
      name: "New choice Delete option optionB",
      exact: true,
    })
    .click();
  await expect(remove).toHaveCount(11);
  await add.click();
  await expect(remove).toHaveCount(12);
  await expect(criterion).toHaveValue("Account changes");

  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const definition = experimentDefinitionSchema.parse(
    JSON.parse(
      await page.getByLabel("Experiment definition JSON").inputValue(),
    ),
  );
  const choice = definition.questions.find(
    (question) => question.kind === "choice",
  );
  expect(choice?.kind).toBe("choice");
  if (choice?.kind !== "choice") throw new Error("Missing Choice question");
  expect(Object.keys(choice.criteria)).toHaveLength(12);
  expect(choice.criteria.optionC).toBe("Account changes");
  expect(choice.criteria.optionA).toBe("Evidence supports option A.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Custom preset created locally.")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Untitled experiment", exact: true })
    .click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(criterion).toHaveValue("Account changes");
  await expect(remove).toHaveCount(12);

  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const referencedDefinition = experimentDefinitionSchema.parse(
    JSON.parse(
      await page.getByLabel("Experiment definition JSON").inputValue(),
    ),
  );
  referencedDefinition.policy.metrics[0].source = {
    questionId: choice.id,
    signal: "choiceProbability",
    option: "optionA",
    aggregation: "average",
  };
  referencedDefinition.policy.rules[0].all.push({
    type: "selectedChoice",
    questionId: choice.id,
    operator: "eq",
    value: "optionB",
  });
  await page
    .getByLabel("Experiment definition JSON")
    .fill(JSON.stringify(referencedDefinition));
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "New choice Delete option optionA",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "New choice Delete option optionB",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "New choice Delete option optionC",
      exact: true,
    }),
  ).toBeEnabled();
  const returnedValue = page.getByRole("textbox", {
    name: "New choice Option value 1",
    exact: true,
  });
  await returnedValue.fill("");
  await returnedValue.pressSequentially("billing", { delay: 20 });
  await expect(returnedValue).toHaveValue("billing");
  await expect(returnedValue).toBeFocused();
  const secondValue = page.getByRole("textbox", {
    name: "New choice Option value 12",
    exact: true,
  });
  await secondValue.fill("billing");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Each option must have a unique returned value." }),
  ).toBeVisible();
  await expect(secondValue).not.toHaveValue("billing");
  await secondValue.fill("technical");
  await secondValue.fill("");
  await secondValue.pressSequentially("42", { delay: 20 });
  await expect(secondValue).toHaveValue("42");
  await expect(secondValue).toBeFocused();
  await page
    .getByRole("textbox", { name: "New choice billing Criteria", exact: true })
    .fill("");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const renamedDefinition = experimentDefinitionSchema.parse(
    JSON.parse(
      await page.getByLabel("Experiment definition JSON").inputValue(),
    ),
  );
  const renamedChoice = renamedDefinition.questions.find(
    (question) => question.id === choice.id,
  );
  expect(
    renamedChoice?.kind === "choice" && renamedChoice.criteria.billing,
  ).toBeNull();
  expect(renamedDefinition.policy.metrics[0].source.option).toBe("billing");
  expect(renamedDefinition.policy.rules[0].all).toContainEqual({
    type: "selectedChoice",
    questionId: choice.id,
    operator: "eq",
    value: "42",
  });
});

test("Studio adds, orders, and removes score levels within the limits", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank", exact: true }).click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Score", exact: true }).click();
  const add = page.getByRole("button", {
    name: "New score Add level",
    exact: true,
  });
  const remove = page.getByRole("button", { name: /New score Delete level/ });
  await expect(remove).toHaveCount(2);
  await expect(remove.first()).toBeDisabled();
  await add.click();
  await page
    .getByRole("textbox", { name: "New score Level 3 Title", exact: true })
    .fill("Medium");
  await page
    .getByRole("textbox", {
      name: "New score Level 3 Description",
      exact: true,
    })
    .fill("Some supporting evidence.");
  await page
    .getByRole("button", { name: "New score Move level up 3", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "New score Level 2 Title", exact: true }),
  ).toHaveValue("Medium");
  await page
    .getByRole("button", { name: "New score Move level down 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New score Move level up 2", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "New score Move level up 1",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "New score Move level down 3",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const definition = experimentDefinitionSchema.parse(
    JSON.parse(
      await page.getByLabel("Experiment definition JSON").inputValue(),
    ),
  );
  const score = definition.questions.find(
    (question) => question.kind === "score",
  );
  expect(score?.kind).toBe("score");
  if (score?.kind !== "score") throw new Error("Missing Score question");
  expect(score.levels.map((level) => level.label)).toEqual([
    "Low",
    "Medium",
    "High",
  ]);
  expect(score.levels[1].description).toBe("Some supporting evidence.");
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  for (let count = 3; count < 10; count += 1) await add.click();
  await expect(add).toBeDisabled();
  await expect(remove).toHaveCount(10);
  for (let count = 10; count > 2; count -= 1) await remove.last().click();
  await expect(remove).toHaveCount(2);
  await expect(remove.first()).toBeDisabled();
  await expect(add).toBeEnabled();
  await page.getByRole("button", { name: "Português (Brasil)" }).click();
  await expect(
    page.getByRole("button", { name: /Adicionar nível/ }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Os critérios descrevem cada nível, do mais baixo ao mais alto. A pontuação começa em 0 e pode ficar entre os níveis.",
    ),
  ).toBeVisible();
});

test("Studio can omit optional yes/no criteria and evaluate the saved preset", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank", exact: true }).click();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(
    page.getByText("Yes criteria (true)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No criteria (false)", { exact: true }),
  ).toBeVisible();
  const criteriaToggle = page.getByRole("checkbox", {
    name: "Is the proposition supported? Define yes/no criteria (optional)",
    exact: true,
  });
  await criteriaToggle.uncheck();
  await expect(
    page.getByRole("textbox", {
      name: "Is the proposition supported? true criteria",
      exact: true,
    }),
  ).toHaveCount(0);
  await criteriaToggle.check();
  await expect(
    page.getByRole("textbox", {
      name: "Is the proposition supported? true criteria",
      exact: true,
    }),
  ).toHaveValue("Evidence supports yes.");
  await criteriaToggle.uncheck();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const definition = experimentDefinitionSchema.parse(
    JSON.parse(
      await page.getByLabel("Experiment definition JSON").inputValue(),
    ),
  );
  expect(definition.questions[0]).not.toHaveProperty("criteria");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Custom preset created locally.")).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Untitled experiment", exact: true })
    .click();
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await expect(page.getByText(/Composite signal/)).toBeVisible();
  await page.getByRole("tab", { name: "Answers", exact: true }).click();
  await page.locator("details").first().locator("summary").click();
  await expect(page.locator("details").first()).toContainText(
    "Is the proposition supported?",
  );
});

test("Studio JSON editor highlights, formats, copies, and preserves editing", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/studio");
  await page.getByRole("button", { name: "New blank", exact: true }).click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Experiment definition JSON",
    exact: true,
  });
  const definition = JSON.parse(await editor.inputValue()) as {
    title: string;
    description: string;
  };
  definition.description = "Visible JSON text ".repeat(40);
  await editor.fill(JSON.stringify(definition));
  await expect(page.locator(".json-editor-gutter")).toHaveText("1");
  await expect(
    page.locator(".json-editor-overlay .text-sky").first(),
  ).toBeVisible();
  await expect(page.getByText("Valid JSON", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Format JSON", exact: true }).click();
  const formatted = JSON.stringify(definition, null, 2);
  await expect(editor).toHaveValue(formatted);
  await expect(page.locator(".json-editor-gutter")).toHaveText(
    Array.from(
      { length: formatted.split("\n").length },
      (_, index) => index + 1,
    ).join("\n"),
  );
  await page.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Copied$/ }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    formatted,
  );

  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially("\n  ", { delay: 20 });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(formatted + "\n  ");
  const scroll = await editor.evaluate((element) => {
    element.scrollTop = 240;
    element.scrollLeft = 80;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return { top: element.scrollTop, left: element.scrollLeft };
  });
  expect(scroll.top).toBeGreaterThan(0);
  expect(scroll.left).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.locator(".json-editor-overlay").evaluate((element) => ({
        top: element.scrollTop,
        left: element.scrollLeft,
      })),
    )
    .toEqual(scroll);
  await expect
    .poll(() =>
      page
        .locator(".json-editor-gutter")
        .evaluate((element) => element.scrollTop),
    )
    .toBe(scroll.top);

  await editor.fill('{"title":');
  await expect(page.getByText("Invalid JSON", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Format JSON", exact: true }),
  ).toBeDisabled();
  await expect(editor).toHaveValue('{"title":');
  definition.title = "Edited JSON";
  await editor.fill(JSON.stringify(definition));
  await page.getByRole("button", { name: "Definition", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Edited JSON");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await page.getByRole("button", { name: "Português (Brasil)" }).click();
  await expect(
    page.getByRole("button", { name: "Formatar JSON", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar JSON", exact: true }),
  ).toBeVisible();
});

test("API JSON views show readable highlighted requests and responses", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Evaluate lab/ }).click();
  await expect(page.getByText(/Composite signal/)).toBeVisible();
  await page.getByRole("tab", { name: "API", exact: true }).click();
  const request = page
    .locator("pre")
    .filter({ has: page.locator(".text-sky") })
    .first();
  const text = await request.innerText();
  expect(JSON.parse(text)).toHaveProperty("questions");
  await expect(request).toHaveAttribute("tabindex", "0");
  await expect(
    page.getByRole("button", { name: "Copy JSON", exact: true }),
  ).toHaveCount(2);
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
