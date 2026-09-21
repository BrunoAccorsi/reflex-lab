import { getExperiment } from "../../src/lib/experiments";
import { createJevProvider } from "../../src/server/jev";

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required for the opt-in live test.");
}

const definition = getExperiment("tool-safety");
const provider = await createJevProvider();
const result = await provider({ definition, state: definition.sampleState });

console.log(JSON.stringify({ model: result.model, requestId: result.requestId, answerKinds: result.answers.map((answer) => answer.kind), usage: result.usage }, null, 2));
