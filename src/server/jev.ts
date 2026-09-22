import { z } from "zod";
import { expandQuestions, validateExperimentState, type ExpandedQuestion } from "@/lib/experiments";
import { normalizeTypedAnswer, type EvaluationInput, type TypedAnswer } from "@/lib/evaluation";

export type JevProviderResult = {
  answers: TypedAnswer[];
  model: string;
  requestId: string | null;
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
  cost: number | null;
  request: Record<string, unknown>;
  rawResponse: unknown;
  provider: "OpenRouter" | "Mock";
};

export class JevProviderError extends Error {
  constructor(message: string, public readonly code: "missing_credentials" | "budget_exhausted" | "rate_limited" | "network" | "malformed_response" | "provider_error", public readonly status?: number) {
    super(message);
    this.name = "JevProviderError";
  }
}

const decisionsResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.unknown()),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional(), total_tokens: z.number().optional(), cost: z.number().optional() }).passthrough().optional(),
}).passthrough();

function renderInstructions(question: ExpandedQuestion) {
  return question.recordLabel ? `${question.instructions} Evaluate record: ${question.recordLabel}.` : question.instructions;
}

export function buildDecisionRequest(input: EvaluationInput, model: string) {
  validateExperimentState(input.definition, input.state);
  const expanded = expandQuestions(input.definition, input.state);
  const questions = Object.fromEntries(expanded.map((question) => {
    if (question.kind === "choice") return [question.expandedId, { type: "choice", instructions: renderInstructions(question), criteria: question.criteria }];
    if (question.kind === "score") return [question.expandedId, { type: "score", instructions: renderInstructions(question), criteria: question.levels.map((level) => `${level.label}: ${level.description}`) }];
    return [question.expandedId, { type: "noul", instructions: renderInstructions(question), criteria: question.criteria }];
  }));
  return {
    expanded,
    request: {
      model,
      state: { experiment: input.definition.title, description: input.definition.description, ...input.state },
      questions,
    } satisfies Record<string, unknown>,
  };
}

export function normalizeDecisionsResponse(payload: unknown, expanded: ExpandedQuestion[], fallbackModel: string, request: Record<string, unknown>, requestId: string | null): JevProviderResult {
  const response = decisionsResponseSchema.parse(payload);
  const expected = new Set(expanded.map((question) => question.expandedId));
  const unknownIds = Object.keys(response.answers).filter((id) => !expected.has(id));
  if (unknownIds.length > 0) throw new Error(`Malformed response: unknown question ids: ${unknownIds.join(", ")}`);
  const answers = expanded.map((question) => {
    if (!(question.expandedId in response.answers)) throw new Error(`Malformed response: missing answer for ${question.expandedId}`);
    return normalizeTypedAnswer(question, response.answers[question.expandedId]);
  });
  const inputTokens = response.usage?.input_tokens ?? null;
  const outputTokens = response.usage?.output_tokens ?? null;
  const totalTokens = response.usage?.total_tokens ?? (inputTokens !== null || outputTokens !== null ? (inputTokens ?? 0) + (outputTokens ?? 0) : null);
  return { answers, model: response.model ?? fallbackModel, requestId, usage: { inputTokens, outputTokens, totalTokens }, cost: response.usage?.cost ?? null, request, rawResponse: payload, provider: "OpenRouter" };
}

function extractProviderErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string") return error.slice(0, 500);
  if (!error || typeof error !== "object") return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message.slice(0, 500) : null;
}

function isBudgetExhausted(status: number, message: string | null): boolean {
  if (status === 402) return true;
  if (status === 401 || !message) return false;
  return /(?:insufficient|not enough|out of|exhausted|depleted|no|zero)\s+(?:available\s+|remaining\s+)?(?:credits?|balance|budget|tokens?)(?:\s+remaining)?|(?:credits?|budget|spend(?:ing)?|quota)\s+(?:limit\s+)?(?:exceeded|exhausted|depleted|reached|used up)/i.test(message);
}

export async function createJevProvider(fetchImpl: typeof fetch = fetch): Promise<(input: EvaluationInput) => Promise<JevProviderResult>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_JEV_MODEL || "typesafe/jev-1.13";
  if (!apiKey) throw new JevProviderError("OPENROUTER_API_KEY is not configured.", "missing_credentials");
  return async (input) => {
    const { expanded, request } = buildDecisionRequest(input, model);
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
        body: JSON.stringify(request),
      });
    } catch {
      throw new JevProviderError("Could not reach OpenRouter.", "network");
    }
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage = extractProviderErrorMessage(raw);
      console.error("[Reflex Lab] OpenRouter request failed", { status: response.status, requestId: response.headers.get("x-request-id"), body: raw });
      if (isBudgetExhausted(response.status, providerMessage)) throw new JevProviderError("You're too late! All free tokens have already been consumed.", "budget_exhausted", response.status);
      if (response.status === 401 || response.status === 403) throw new JevProviderError(providerMessage ? `OpenRouter rejected the API key: ${providerMessage}` : "OpenRouter rejected the API key.", "provider_error", response.status);
      if (response.status === 429) throw new JevProviderError(providerMessage ? `OpenRouter rate limit reached: ${providerMessage}` : "OpenRouter rate limit reached. Try again shortly.", "rate_limited", response.status);
      throw new JevProviderError(providerMessage ? `OpenRouter returned an error (${response.status}): ${providerMessage}` : `OpenRouter returned an error (${response.status}).`, "provider_error", response.status);
    }
    try {
      return normalizeDecisionsResponse(raw, expanded, model, request, response.headers.get("x-request-id"));
    } catch (error) {
      throw new JevProviderError(error instanceof Error ? error.message : "Malformed decision.", "malformed_response");
    }
  };
}

function mockNoulValue(id: string, index: number) {
  const lowSignals = ["credentialRisk", "destructive", "contradiction", "unsupported", "sensitive", "unsafe"];
  if (lowSignals.some((signal) => id.includes(signal))) return 0.12 + index * 0.04;
  if (id.includes("humanEscalation")) return 0.68;
  return Math.max(0.08, 0.86 - index * 0.12);
}

export function createMockJevProvider(): (input: EvaluationInput) => Promise<JevProviderResult> {
  return async (input) => {
    const model = "mock/jev-local";
    const { expanded, request } = buildDecisionRequest(input, model);
    const rawAnswers = Object.fromEntries(expanded.map((question) => {
      const index = question.recordIndex ?? 0;
      if (question.kind === "choice") {
        const options = Object.keys(question.criteria);
        const selectedIndex = Math.min(index, options.length - 1);
        const selected = options[selectedIndex];
        const remainder = 0.14 / Math.max(1, options.length - 1);
        return [question.expandedId, { type: "choice", choice: selected, confidence: 0.86, probabilities: Object.fromEntries(options.map((option) => [option, option === selected ? 0.86 : remainder])) }];
      }
      if (question.kind === "score") {
        const max = question.levels.length - 1;
        const score = Math.max(0, max - index * 0.7 - (question.id.includes("effort") || question.id.includes("risk") ? 1.2 : 0.3));
        const rounded = Math.round(score);
        return [question.expandedId, { type: "score", score, confidence: 0.72, probabilities: Object.fromEntries(question.levels.map((_, levelIndex) => [String(levelIndex), levelIndex === rounded ? 0.72 : 0.28 / Math.max(1, max)])) }];
      }
      return [question.expandedId, { type: "noul", noul: mockNoulValue(question.id, index) }];
    }));
    const rawResponse = { model, answers: rawAnswers, usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0 } };
    const normalized = normalizeDecisionsResponse(rawResponse, expanded, model, request, "mock-request");
    return { ...normalized, provider: "Mock" };
  };
}

export async function evaluateWithJev(input: EvaluationInput) {
  const provider = process.env.MOCK_JEV === "true" ? createMockJevProvider() : await createJevProvider();
  return provider(input);
}
