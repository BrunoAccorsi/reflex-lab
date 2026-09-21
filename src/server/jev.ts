import { getScenario, type Scenario } from "@/lib/scenarios";
import { normalizeProviderDecision, type EvaluationInput, type ProviderDecision } from "@/lib/evaluation";
import { z } from "zod";

export type JevProviderResult = {
  decision: ProviderDecision;
  tokenUsage: number | null;
  model: string;
};

export class JevProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_credentials" | "rate_limited" | "network" | "malformed_response" | "provider_error",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "JevProviderError";
  }
}

const scoreCriteria = ["Very low", "Low", "Moderate", "High", "Very high"] as const;

const decisionsResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.unknown()),
  usage: z.object({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

const choiceAnswerSchema = z.object({
  type: z.literal("choice").optional(),
  choice: z.string(),
  probabilities: z.record(z.number().finite().min(0)),
  confidence: z.number().finite().min(0).max(1).optional(),
}).passthrough();

const scoreAnswerSchema = z.object({
  type: z.literal("score").optional(),
  score: z.number().finite(),
}).passthrough();

const noulAnswerSchema = z.object({
  type: z.literal("noul").optional(),
  noul: z.number().finite().min(0).max(1),
}).passthrough();

function buildDecisionQuestions(scenario: Scenario) {
  return Object.fromEntries(scenario.questions.map((question) => {
    if (question.kind === "choice") {
      const criteria = Object.fromEntries((question.options ?? []).map((option) => [
        option,
        `Choose ${option.replaceAll("-", " ")} when it is the best answer to: ${question.label}`,
      ]));
      return [question.id, { type: "choice", instructions: question.label, criteria }];
    }
    if (question.kind === "score") {
      return [question.id, {
        type: "score",
        instructions: `${question.label} Select the closest ordered level.`,
        criteria: scoreCriteria.map((level) => `${level}: ${question.label}`),
      }];
    }
    return [question.id, {
      type: "noul",
      instructions: question.label,
      criteria: {
        true: `The evidence supports yes for: ${question.label}`,
        false: `The evidence supports no for: ${question.label}`,
      },
    }];
  }));
}

function normalizeDecisionsResponse(payload: unknown, scenario: Scenario, fallbackModel: string): JevProviderResult {
  const response = decisionsResponseSchema.parse(payload);
  const choiceQuestion = scenario.questions.find((question) => question.kind === "choice");
  const scoreQuestion = scenario.questions.find((question) => question.kind === "score");
  const booleanQuestion = scenario.questions.find((question) => question.kind === "boolean");
  if (!choiceQuestion || !scoreQuestion || !booleanQuestion) {
    throw new Error(`Scenario ${scenario.id} is missing a required decision question`);
  }

  const choiceAnswer = choiceAnswerSchema.parse(response.answers[choiceQuestion.id]);
  const scoreAnswer = scoreAnswerSchema.parse(response.answers[scoreQuestion.id]);
  const booleanAnswer = noulAnswerSchema.parse(response.answers[booleanQuestion.id]);
  const highestProbability = Math.max(...Object.values(choiceAnswer.probabilities));
  const normalizedScore = Math.min(1, Math.max(0, scoreAnswer.score / (scoreCriteria.length - 1)));
  const decision = normalizeProviderDecision({
    choice: choiceAnswer.choice,
    score: normalizedScore,
    decision: booleanAnswer.noul >= 0.5,
    confidence: choiceAnswer.confidence ?? highestProbability,
    probabilities: choiceAnswer.probabilities,
  }, scenario);
  const tokenUsage = response.usage
    ? (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)
    : null;
  return { decision, tokenUsage, model: response.model ?? fallbackModel };
}

function extractProviderErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string") return error.slice(0, 500);
  if (!error || typeof error !== "object") return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message.slice(0, 500) : null;
}

export async function createJevProvider(fetchImpl: typeof fetch = fetch): Promise<(input: EvaluationInput) => Promise<JevProviderResult>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_JEV_MODEL || "typesafe/jev-1.13";
  if (!apiKey) {
    throw new JevProviderError("OPENROUTER_API_KEY is not configured.", "missing_credentials");
  }

  return async (input) => {
    const scenario = getScenario(input.scenarioId);
    let response: Response;
    try {
      response = await fetchImpl("https://openrouter.ai/api/alpha/decisions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
          ...(process.env.OPENROUTER_APP_NAME ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME } : {}),
        },
        body: JSON.stringify({
          model,
          state: {
            scenario: scenario.title,
            description: scenario.description,
            ...input.fields,
          },
          questions: buildDecisionQuestions(scenario),
        }),
      });
    } catch {
      throw new JevProviderError("Could not reach OpenRouter.", "network");
    }

    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage = extractProviderErrorMessage(raw);
      console.error("[Reflex Lab] OpenRouter request failed", {
        status: response.status,
        requestId: response.headers.get("x-request-id"),
        body: raw,
      });
      if (response.status === 401 || response.status === 403) {
        throw new JevProviderError(providerMessage ? `OpenRouter rejected the API key: ${providerMessage}` : "OpenRouter rejected the API key.", "provider_error", response.status);
      }
      if (response.status === 429) {
        throw new JevProviderError(providerMessage ? `OpenRouter rate limit reached: ${providerMessage}` : "OpenRouter rate limit reached. Try again shortly.", "rate_limited", response.status);
      }
      throw new JevProviderError(providerMessage ? `OpenRouter returned an error (${response.status}): ${providerMessage}` : `OpenRouter returned an error (${response.status}).`, "provider_error", response.status);
    }

    try {
      return normalizeDecisionsResponse(raw, scenario, model);
    } catch (error) {
      throw new JevProviderError(error instanceof Error ? error.message : "Malformed decision.", "malformed_response");
    }
  };
}

export function createMockJevProvider(): (input: EvaluationInput) => Promise<JevProviderResult> {
  return async (input) => {
    const scenario = getScenario(input.scenarioId);
    const options = scenario.questions.find((question) => question.kind === "choice")?.options ?? [];
    const selected = options[0] ?? "review";
    const probabilities = Object.fromEntries(options.map((option, index) => [option, index === 0 ? 0.86 : 0.14 / Math.max(1, options.length - 1)]));
    const decision = normalizeProviderDecision({ choice: selected, score: 0.24, decision: false, confidence: 0.86, probabilities }, scenario);
    return { decision, tokenUsage: 0, model: "mock/jev-local" };
  };
}

export async function evaluateWithJev(input: EvaluationInput): Promise<JevProviderResult> {
  const provider = process.env.MOCK_JEV === "true" ? createMockJevProvider() : await createJevProvider();
  return provider(input);
}
