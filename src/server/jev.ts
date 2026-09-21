import { getScenario, type Scenario } from "@/lib/scenarios";
import { normalizeProviderDecision, type EvaluationInput, type ProviderDecision } from "@/lib/evaluation";

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

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    choice: { type: "string", description: "The selected option from the choice question." },
    score: { type: "number", description: "The normalized score from 0 to 1." },
    decision: { type: "boolean", description: "The boolean answer to the scenario question." },
    confidence: { type: "number", description: "Calibrated confidence from 0 to 1." },
    probabilities: {
      type: "object",
      description: "Probability for every available choice, summing to 1.",
      additionalProperties: { type: "number" },
    },
  },
  required: ["choice", "score", "decision", "confidence", "probabilities"],
} as const;

function buildPrompt(input: EvaluationInput, scenario: Scenario) {
  const questions = scenario.questions
    .map((question) => `${question.id}: ${question.label}${question.options ? ` Options: ${question.options.join(", ")}` : ""}`)
    .join("\n");
  const fields = Object.entries(input.fields).map(([key, value]) => `${key}: ${value}`).join("\n");
  return `Evaluate this automation scenario. Return only the requested structured decision.\n\nScenario: ${scenario.title}\nQuestions:\n${questions}\n\nInput:\n${fields}\n\nRules: choose exactly one allowed option; score and confidence must be between 0 and 1; probabilities must include every choice option and sum to 1; decision answers the boolean question.`;
}

function extractContent(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "choice" in payload) return payload;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return content;
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
      response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {}),
          ...(process.env.OPENROUTER_APP_NAME ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: "You are a structured decision engine. Never return prose." },
            { role: "user", content: buildPrompt(input, scenario) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "reflex_decision", strict: true, schema: responseSchema },
          },
        }),
      });
    } catch {
      throw new JevProviderError("Could not reach OpenRouter.", "network");
    }

    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new JevProviderError("OpenRouter rejected the API key.", "provider_error", response.status);
      }
      if (response.status === 429) {
        throw new JevProviderError("OpenRouter rate limit reached. Try again shortly.", "rate_limited", response.status);
      }
      throw new JevProviderError("OpenRouter returned an error.", "provider_error", response.status);
    }

    const parsed = extractContent(raw);
    if (!parsed) throw new JevProviderError("OpenRouter returned a malformed decision.", "malformed_response");
    try {
      const decision = normalizeProviderDecision(parsed, scenario);
      const usage = raw && typeof raw === "object" && "usage" in raw ? (raw as { usage?: { total_tokens?: number } }).usage?.total_tokens : null;
      return { decision, tokenUsage: usage ?? null, model };
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
