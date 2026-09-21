import { describe, expect, it } from "vitest";
import { applyConfidenceGate, normalizeProviderDecision, validateFields } from "@/lib/evaluation";
import { getScenario, scenarios } from "@/lib/scenarios";

describe("scenario registry", () => {
  it("contains all five experiments with the shared question pipeline", () => {
    expect(scenarios).toHaveLength(5);
    for (const scenario of scenarios) {
      expect(scenario.questions.map((question) => question.kind)).toEqual(["choice", "score", "boolean"]);
      expect(Object.keys(scenario.sample)).toEqual(scenario.fields.map((field) => field.id));
    }
  });
});

describe("decision normalization", () => {
  it("normalizes probabilities and preserves the winning choice", () => {
    const decision = normalizeProviderDecision({ choice: "billing", score: 0.4, decision: true, confidence: 0.82, probabilities: { billing: 8, technical: 2, account: 0, general: 0 } }, getScenario("support-triage"));
    expect(decision.probabilities.billing).toBe(0.8);
    expect(decision.choice).toBe("billing");
  });

  it("rejects an invalid answer", () => {
    expect(() => normalizeProviderDecision({ choice: "not-a-team", score: 0.4, decision: true, confidence: 0.82, probabilities: { billing: 1 } }, getScenario("support-triage"))).toThrow(/not valid/);
  });
});

describe("confidence boundaries", () => {
  const decision = { choice: "billing", score: 0.4, decision: true, confidence: 0.8, probabilities: { billing: 1 } };

  it("passes at the threshold", () => expect(applyConfidenceGate(decision, 0.8).gatePassed).toBe(true));
  it("fails immediately below the threshold", () => expect(applyConfidenceGate({ ...decision, confidence: 0.799 }, 0.8).gatePassed).toBe(false));
  it("clamps an out-of-range threshold", () => expect(applyConfidenceGate(decision, 4).threshold).toBe(1));
});

describe("input validation", () => {
  it("reports the exact missing fields", () => expect(() => validateFields({ scenarioId: "support-triage", fields: { ticket: "only one field" } })).toThrow("Account context"));
});
