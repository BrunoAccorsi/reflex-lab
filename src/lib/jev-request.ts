import {
  expandQuestions,
  validateExperimentState,
  type ExperimentDefinitionV1,
  type ExperimentState,
  type ExpandedQuestion,
} from "@/lib/experiments";

function renderInstructions(question: ExpandedQuestion) {
  return question.recordLabel
    ? `${question.instructions} Evaluate record: ${question.recordLabel}.`
    : question.instructions;
}

export function buildDecisionRequest(
  input: { definition: ExperimentDefinitionV1; state: ExperimentState },
  model: string,
) {
  validateExperimentState(input.definition, input.state);
  const expanded = expandQuestions(input.definition, input.state);
  const questions = Object.fromEntries(
    expanded.map((question) => {
      if (question.kind === "choice")
        return [
          question.expandedId,
          {
            type: "choice",
            instructions: renderInstructions(question),
            criteria: question.criteria,
          },
        ];
      if (question.kind === "score")
        return [
          question.expandedId,
          {
            type: "score",
            instructions: renderInstructions(question),
            criteria: question.levels.map(
              (level) => `${level.label}: ${level.description}`,
            ),
          },
        ];
      return [
        question.expandedId,
        {
          type: "noul",
          instructions: renderInstructions(question),
          ...(question.criteria ? { criteria: question.criteria } : {}),
        },
      ];
    }),
  );
  return {
    expanded,
    request: {
      model,
      state: {
        experiment: input.definition.title,
        description: input.definition.description,
        ...input.state,
      },
      questions,
    } satisfies Record<string, unknown>,
  };
}
