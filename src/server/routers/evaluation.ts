import { TRPCError } from "@trpc/server";
import { applyConfidenceGate, evaluationInputSchema, validateFields } from "@/lib/evaluation";
import { evaluateWithJev, JevProviderError } from "@/server/jev";
import { publicProcedure, createTRPCRouter } from "@/server/trpc";

export const evaluationRouter = createTRPCRouter({
  evaluate: publicProcedure.input(evaluationInputSchema).mutation(async ({ input }) => {
    const startedAt = performance.now();
    try {
      validateFields(input);
      const result = await evaluateWithJev(input);
      return {
        scenarioId: input.scenarioId,
        ...result.decision,
        latencyMs: Math.round(performance.now() - startedAt),
        tokenUsage: result.tokenUsage,
        model: result.model,
        ...applyConfidenceGate(result.decision, 0.8),
      };
    } catch (error) {
      if (error instanceof JevProviderError) {
        throw new TRPCError({ code: error.code === "missing_credentials" ? "PRECONDITION_FAILED" : error.code === "rate_limited" ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY", message: error.message });
      }
      if (error instanceof Error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Evaluation failed." });
    }
  }),
});
