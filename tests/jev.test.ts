import { describe, expect, it, vi } from "vitest";
import { createJevProvider } from "@/server/jev";

const validPayload = {
  model: "typesafe/jev-1.13-20260917",
  answers: {
    team: { type: "choice", choice: "billing", confidence: 0.91, probabilities: { billing: 0.91, technical: 0.03, account: 0.03, general: 0.03 } },
    urgency: { type: "score", score: 1.6, probabilities: { "0": 0.1, "1": 0.4, "2": 0.4, "3": 0.1, "4": 0 } },
    refund: { type: "noul", noul: 0.88 },
  },
  usage: { input_tokens: 40, output_tokens: 2 },
};

describe("OpenRouter Jev provider", () => {
  it("normalizes a structured mocked provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayload), { status: 200, headers: { "content-type": "application/json" } }));
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const provider = await createJevProvider(fetchMock);
    const result = await provider({ scenarioId: "support-triage", fields: { ticket: "duplicate charge", context: "billing account" } });
    expect(result.decision.choice).toBe("billing");
    expect(result.decision.score).toBe(0.4);
    expect(result.decision.decision).toBe(true);
    expect(result.tokenUsage).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith("https://openrouter.ai/api/alpha/decisions", expect.objectContaining({ method: "POST" }));
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      model: "typesafe/jev-1.13",
      state: { scenario: "Support-ticket triage", ticket: "duplicate charge" },
      questions: {
        team: { type: "choice" },
        urgency: { type: "score" },
        refund: { type: "noul" },
      },
    });
    expect(request).not.toHaveProperty("messages");
    expect(request).not.toHaveProperty("response_format");
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("surfaces rate limits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 }));
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const provider = await createJevProvider(fetchMock);
    await expect(provider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "rate_limited", message: expect.stringContaining("slow down") });
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("reports missing credentials before making a request", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    await expect(createJevProvider(vi.fn())).rejects.toMatchObject({ code: "missing_credentials" });
    if (previousKey !== undefined) process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("rejects malformed and unreachable provider responses", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const malformedProvider = await createJevProvider(vi.fn().mockResolvedValue(new Response(JSON.stringify({ answers: {} }), { status: 200 })));
    await expect(malformedProvider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "malformed_response" });
    const networkProvider = await createJevProvider(vi.fn().mockRejectedValue(new Error("offline")));
    await expect(networkProvider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "network" });
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("preserves the upstream status and message for unexpected provider errors", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const provider = await createJevProvider(vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "response_format is not supported" } }), { status: 400 })));
    await expect(provider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "provider_error", status: 400, message: "OpenRouter returned an error (400): response_format is not supported" });
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });
});
