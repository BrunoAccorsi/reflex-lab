import { createTRPCRouter } from "@/server/trpc";
import { evaluationRouter } from "@/server/routers/evaluation";

export const appRouter = createTRPCRouter({
  evaluation: evaluationRouter,
});

export type AppRouter = typeof appRouter;
