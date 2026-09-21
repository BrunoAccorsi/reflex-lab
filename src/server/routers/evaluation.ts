import { TRPCError } from "@trpc/server";
import { evaluationInputSchema } from "@/lib/evaluation";
import { validateExperimentState } from "@/lib/experiments";
import { evaluateWithJev, JevProviderError } from "@/server/jev";
import { publicProcedure, createTRPCRouter } from "@/server/trpc";

export const evaluationRouter = createTRPCRouter({
  evaluate: publicProcedure.input(evaluationInputSchema).mutation(async ({ input }) => {
    const startedAt = performance.now();
    try {
      validateExperimentState(input.definition, input.state);
      const result = await evaluateWithJev(input);
      return {
        experimentId: input.definition.id,
        answers: result.answers,
        telemetry: {
          provider: result.provider,
          model: result.model,
          requestId: result.requestId,
          latencyMs: Math.round(performance.now() - startedAt),
          usage: result.usage,
          cost: result.cost,
        },
        request: result.request,
        rawResponse: result.rawResponse,
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
