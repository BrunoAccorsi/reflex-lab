import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExperiment } from "@/lib/experiments";
import { buildDecisionRequest, createJevProvider } from "@/server/jev";
import { evaluationRouter } from "@/server/routers/evaluation";

const definition = getExperiment("tool-safety");
const input = { definition, state: definition.sampleState };
const validPayload = {
  model: "typesafe/jev-1.13-20260917",
  answers: {
    action: {
      type: "choice",
      choice: "confirm",
      confidence: 0.91,
      probabilities: {
        proceed: 0.03,
        confirm: 0.91,
        inspect: 0.04,
        stop: 0.02,
      },
    },
    risk: {
      type: "score",
      score: 3.2,
      confidence: 0.7,
      probabilities: { 0: 0, 1: 0.05, 2: 0.15, 3: 0.55, 4: 0.25 },
    },
    authorized: { type: "noul", noul: 0.88 },
    destructive: { type: "noul", noul: 0.82 },
    reversible: { type: "noul", noul: 0.21 },
    scopeClear: { type: "noul", noul: 0.74 },
  },
  usage: {
    input_tokens: 40,
    output_tokens: 12,
    total_tokens: 52,
    cost: 0.00012,
  },
};

describe("OpenRouter Jev Decisions provider", () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
  });
  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("sends native questions and preserves detailed answers and telemetry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validPayload), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-123",
        },
      }),
    );
    const result = await (await createJevProvider(fetchMock))(input);
    expect(result.answers).toHaveLength(6);
    expect(result.answers[0]).toMatchObject({
      kind: "choice",
      selected: "confirm",
      criteria:
        definition.questions[0].kind === "choice"
          ? definition.questions[0].criteria
          : {},
    });
    expect(result.answers[1]).toMatchObject({
      kind: "score",
      rawScore: 3.2,
      normalizedScore: 0.8,
    });
    expect(result.answers[2]).toMatchObject({
      kind: "noul",
      probabilityYes: 0.88,
      probabilityNo: 0.12,
    });
    expect(result).toMatchObject({
      requestId: "req-123",
      usage: { inputTokens: 40, outputTokens: 12, totalTokens: 52 },
      cost: 0.00012,
    });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      model: "typesafe/jev-1.13",
      state: { experiment: "Tool-call safety gate" },
      questions: {
        action: { type: "choice" },
        risk: { type: "score" },
        authorized: { type: "noul" },
      },
    });
    expect(request).not.toHaveProperty("messages");
    expect(JSON.stringify(result.request)).not.toContain("test-key");
    expect(result.rawResponse).toEqual(validPayload);
  });

  it("builds repeated record questions", () => {
    const github = getExperiment("github-prioritization");
    const built = buildDecisionRequest(
      { definition: github, state: github.sampleState },
      "test/model",
    );
    expect(built.expanded).toHaveLength(15);
    expect(built.request.questions).toHaveProperty("impact__0");
    expect(built.request.questions).toHaveProperty("blocked__2");
  });

  it("rejects missing, unknown, and malformed provider answers", async () => {
    const missing = await createJevProvider(
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...validPayload, answers: {} }), {
          status: 200,
        }),
      ),
    );
    await expect(missing(input)).rejects.toMatchObject({
      code: "malformed_response",
      message: expect.stringContaining("missing answer"),
    });
    const unknown = await createJevProvider(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...validPayload,
            answers: { ...validPayload.answers, surprise: { noul: 1 } },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(unknown(input)).rejects.toMatchObject({
      code: "malformed_response",
      message: expect.stringContaining("unknown question"),
    });
  });

  it("surfaces provider, rate-limit, network, and credential errors", async () => {
    const rateLimited = await createJevProvider(
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "slow down" } }), {
          status: 429,
        }),
      ),
    );
    await expect(rateLimited(input)).rejects.toMatchObject({
      code: "rate_limited",
      message: expect.stringContaining("slow down"),
    });
    const providerError = await createJevProvider(
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "bad questions" } }),
            { status: 400 },
          ),
        ),
    );
    await expect(providerError(input)).rejects.toMatchObject({
      code: "provider_error",
      status: 400,
      message: expect.stringContaining("bad questions"),
    });
    const network = await createJevProvider(
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    await expect(network(input)).rejects.toMatchObject({ code: "network" });
    delete process.env.OPENROUTER_API_KEY;
    await expect(createJevProvider(vi.fn())).rejects.toMatchObject({
      code: "missing_credentials",
    });
  });

  it("recognizes an exhausted key budget without confusing it with rate limiting or authentication", async () => {
    for (const [status, message] of [
      [402, "Payment required"],
      [403, "Insufficient credits"],
      [403, "This key is out of budget"],
      [429, "Credit limit exceeded"],
    ] as const) {
      const provider = await createJevProvider(
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ error: { message } }), { status }),
          ),
      );
      await expect(provider(input)).rejects.toMatchObject({
        code: "budget_exhausted",
        status,
        message: "You're too late! All free tokens have already been consumed.",
      });
    }
    const invalidKey = await createJevProvider(
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "Invalid API key" } }),
            { status: 403 },
          ),
        ),
    );
    await expect(invalidKey(input)).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("passes the exhausted-budget message to the client as payment required", async () => {
    const previousMockSetting = process.env.MOCK_JEV;
    process.env.MOCK_JEV = "false";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "Insufficient credits" } }),
            { status: 402 },
          ),
        ),
    );
    try {
      await expect(
        evaluationRouter.createCaller({}).evaluate(input),
      ).rejects.toMatchObject({
        code: "PAYMENT_REQUIRED",
        message: "You're too late! All free tokens have already been consumed.",
      });
    } finally {
      vi.unstubAllGlobals();
      if (previousMockSetting === undefined) delete process.env.MOCK_JEV;
      else process.env.MOCK_JEV = previousMockSetting;
    }
  });
});
