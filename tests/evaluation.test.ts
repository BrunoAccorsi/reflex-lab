import { describe, expect, it } from "vitest";
import { calculateRanking, compareResults, evaluatePolicy, normalizeTypedAnswer, type ExperimentResult } from "@/lib/evaluation";
import { definitionLimits, expandQuestions, experimentDefinitionSchema, experiments, getExperiment, validateExperimentState } from "@/lib/experiments";
import { createMockJevProvider } from "@/server/jev";

describe("experiment definitions", () => {
  it("ships six valid focused labs", () => {
    expect(experiments).toHaveLength(6);
    expect(experiments.map((item) => item.id)).toEqual(["support-orchestration", "tool-safety", "opportunity-scorecard", "candidate-matching", "response-audit", "github-prioritization"]);
    for (const definition of experiments) expect(experimentDefinitionSchema.parse(definition)).toEqual(definition);
  });

  it("expands record questions with stable ids and labels", () => {
    const definition = getExperiment("candidate-matching");
    const expanded = expandQuestions(definition, definition.sampleState);
    expect(expanded).toHaveLength(8);
    expect(expanded[0]).toMatchObject({ expandedId: "skillsFit__0", recordIndex: 0, recordLabel: "Alex" });
    expect(expanded[1]).toMatchObject({ expandedId: "skillsFit__1", recordIndex: 1, recordLabel: "Jordan" });
  });

  it("validates state, definition versions, and expansion limits", () => {
    const support = getExperiment("support-orchestration");
    expect(() => validateExperimentState(support, { ticket: "x", context: "" })).toThrow("Account context");
    expect(experimentDefinitionSchema.safeParse({ ...support, version: 2 }).success).toBe(false);
    const github = getExperiment("github-prioritization");
    expect(() => expandQuestions(github, { ...github.sampleState, issues: Array.from({ length: definitionLimits.records + 1 }, (_, index) => ({ title: String(index), body: "x" })) })).toThrow(/must contain/);
  });
});

describe("typed answer normalization", () => {
  const support = getExperiment("support-orchestration");
  const expanded = expandQuestions(support, support.sampleState);

  it("preserves full Choice, Score, and Noul evidence", () => {
    const choice = normalizeTypedAnswer(expanded.find((item) => item.id === "topic")!, { choice: "billing", confidence: 0.9, probabilities: { billing: 9, technical: 1, account: 0, general: 0 } });
    const score = normalizeTypedAnswer(expanded.find((item) => item.id === "urgency")!, { score: 3.2, confidence: 0.7, probabilities: { 0: 0, 1: 0, 2: 0.2, 3: 0.6, 4: 0.2 } });
    const noul = normalizeTypedAnswer(expanded.find((item) => item.id === "repeatContact")!, { noul: 0.82 });
    expect(choice).toMatchObject({ kind: "choice", selected: "billing", probabilities: { billing: 0.9 } });
    expect(score).toMatchObject({ kind: "score", rawScore: 3.2, normalizedScore: 0.8 });
    expect(score.kind === "score" && score.legend).toHaveLength(5);
    expect(noul).toMatchObject({ kind: "noul", probabilityYes: 0.82 });
    expect(noul.kind === "noul" && noul.probabilityNo).toBeCloseTo(0.18);
  });

  it("rejects malformed, incomplete, and mismatched answers", () => {
    const choiceQuestion = expanded.find((item) => item.id === "topic")!;
    expect(() => normalizeTypedAnswer(choiceQuestion, { choice: "billing", probabilities: { billing: 1 } })).toThrow(/incomplete/);
    expect(() => normalizeTypedAnswer(choiceQuestion, { choice: "technical", probabilities: { billing: 0.8, technical: 0.2, account: 0, general: 0 } })).toThrow(/highest/);
    expect(() => normalizeTypedAnswer(expanded.find((item) => item.id === "urgency")!, { score: 8, probabilities: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1 } })).toThrow(/outside/);
  });
});

describe("deterministic composition", () => {
  it("calculates metrics, ordered rule traces, and rankings", async () => {
    const support = getExperiment("support-orchestration");
    const supportResult = await createMockJevProvider()({ definition: support, state: support.sampleState });
    const policy = evaluatePolicy(support, supportResult.answers);
    expect(policy.metrics.every((metric) => Number.isFinite(metric.contribution))).toBe(true);
    expect(policy.rules.flatMap((rule) => rule.conditions).every((condition) => typeof condition.passed === "boolean")).toBe(true);

    const candidates = getExperiment("candidate-matching");
    const candidateResult = await createMockJevProvider()({ definition: candidates, state: candidates.sampleState });
    const ranking = calculateRanking(candidates, candidates.sampleState, candidateResult.answers);
    expect(ranking).toHaveLength(2);
    expect(ranking[0].score).toBeGreaterThan(ranking[1].score);
  });

  it("computes compatible previous-run deltas", async () => {
    const definition = getExperiment("response-audit");
    const provider = createMockJevProvider();
    const firstProvider = await provider({ definition, state: definition.sampleState });
    const first: ExperimentResult = { experimentId: definition.id, answers: firstProvider.answers, telemetry: { provider: "Mock", model: "mock", requestId: null, latencyMs: 1, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, cost: 0 }, request: firstProvider.request, rawResponse: firstProvider.rawResponse };
    const deltas = compareResults(first, first);
    expect(deltas).toHaveLength(definition.questions.length);
    expect(deltas.every((delta) => delta.delta === 0)).toBe(true);
    expect(compareResults(first, { ...first, experimentId: "other" })).toEqual([]);
  });
});
