import { z } from "zod";
import { getScenario, scenarioIdSchema, type Scenario } from "@/lib/scenarios";

export const evaluationInputSchema = z.object({
  scenarioId: scenarioIdSchema,
  fields: z.record(z.string().min(1), z.string().trim().min(1).max(5000)),
});

export const providerDecisionSchema = z.object({
  choice: z.string().min(1),
  score: z.number().finite().min(0).max(1),
  decision: z.boolean(),
  confidence: z.number().finite().min(0).max(1),
  probabilities: z.record(z.number().finite().min(0)),
});

export type EvaluationInput = z.infer<typeof evaluationInputSchema>;
export type ProviderDecision = z.infer<typeof providerDecisionSchema>;

export type EvaluationResult = ProviderDecision & {
  scenarioId: EvaluationInput["scenarioId"];
  latencyMs: number;
  tokenUsage: number | null;
  model: string;
  threshold: number;
  gatePassed: boolean;
  gateMessage: string;
};

export function normalizeProviderDecision(value: unknown, scenario: Scenario): ProviderDecision {
  const decision = providerDecisionSchema.parse(value);
  const allowedChoices = scenario.questions.find((question) => question.kind === "choice")?.options ?? [];
  if (!allowedChoices.includes(decision.choice)) {
    throw new Error(`Malformed response: choice "${decision.choice}" is not valid for ${scenario.id}`);
  }

  const total = Object.values(decision.probabilities).reduce((sum, probability) => sum + probability, 0);
  if (total <= 0) {
    throw new Error("Malformed response: probabilities must have a positive total");
  }

  const probabilities = Object.fromEntries(
    Object.entries(decision.probabilities).map(([key, probability]) => [key, probability / total]),
  );
  const winningChoice = Object.entries(probabilities).sort(([, left], [, right]) => right - left)[0]?.[0];
  if (winningChoice !== decision.choice) {
    throw new Error("Malformed response: choice must match the highest probability");
  }

  return { ...decision, probabilities };
}

export function applyConfidenceGate(decision: ProviderDecision, threshold: number) {
  const safeThreshold = Math.min(1, Math.max(0, threshold));
  const gatePassed = decision.confidence >= safeThreshold;
  return {
    threshold: safeThreshold,
    gatePassed,
    gateMessage: gatePassed
      ? `Automation gate passed: ${(decision.confidence * 100).toFixed(0)}% confidence meets the ${(safeThreshold * 100).toFixed(0)}% threshold.`
      : `Automation gate held: ${(decision.confidence * 100).toFixed(0)}% confidence is below the ${(safeThreshold * 100).toFixed(0)}% threshold.`,
  };
}

export function validateFields(input: EvaluationInput, scenario = getScenario(input.scenarioId)) {
  const missing = scenario.fields.filter((field) => !input.fields[field.id]?.trim()).map((field) => field.label);
  if (missing.length > 0) {
    throw new Error(`Missing input: ${missing.join(", ")}`);
  }
  return input;
}
