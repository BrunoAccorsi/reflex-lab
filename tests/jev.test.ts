import { describe, expect, it, vi } from "vitest";
import { createJevProvider } from "@/server/jev";

const validPayload = { choices: [{ message: { content: JSON.stringify({ choice: "billing", score: 0.4, decision: true, confidence: 0.91, probabilities: { billing: 0.91, technical: 0.03, account: 0.03, general: 0.03 } }) } }], usage: { total_tokens: 42 } };

describe("OpenRouter Jev provider", () => {
  it("normalizes a structured mocked provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayload), { status: 200, headers: { "content-type": "application/json" } }));
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const provider = await createJevProvider(fetchMock);
    const result = await provider({ scenarioId: "support-triage", fields: { ticket: "duplicate charge", context: "billing account" } });
    expect(result.decision.choice).toBe("billing");
    expect(result.tokenUsage).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("surfaces rate limits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "slow down" }), { status: 429 }));
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const provider = await createJevProvider(fetchMock);
    await expect(provider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "rate_limited" });
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
    const malformedProvider = await createJevProvider(vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    await expect(malformedProvider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "malformed_response" });
    const networkProvider = await createJevProvider(vi.fn().mockRejectedValue(new Error("offline")));
    await expect(networkProvider({ scenarioId: "support-triage", fields: { ticket: "x", context: "y" } })).rejects.toMatchObject({ code: "network" });
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });
});
