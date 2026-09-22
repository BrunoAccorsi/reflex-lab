import { z } from "zod";
import { rawDefinitions } from "@/lib/builtin-experiments";

export const EXPERIMENT_VERSION = 1 as const;
export const definitionLimits = {
  stateBytes: 50_000,
  definitionBytes: 100_000,
  records: 12,
  questions: 48,
  choiceOptions: 12,
  scoreLevels: 10,
} as const;

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9-_]*$/);
const textSchema = z.string().trim().min(1).max(4_000);

export const stateFieldSchema = z.discriminatedUnion("type", [
  z.object({
    id: slugSchema,
    type: z.literal("text"),
    label: textSchema,
    description: z.string().max(500).default(""),
    required: z.boolean().default(true),
  }),
  z.object({
    id: slugSchema,
    type: z.literal("multiline"),
    label: textSchema,
    description: z.string().max(500).default(""),
    required: z.boolean().default(true),
  }),
  z.object({
    id: slugSchema,
    type: z.literal("json"),
    label: textSchema,
    description: z.string().max(500).default(""),
    required: z.boolean().default(true),
  }),
  z.object({
    id: slugSchema,
    type: z.literal("records"),
    label: textSchema,
    description: z.string().max(500).default(""),
    required: z.boolean().default(true),
    minItems: z.number().int().min(1).max(definitionLimits.records).default(1),
    maxItems: z.number().int().min(1).max(definitionLimits.records).default(6),
    columns: z
      .array(
        z.object({
          id: slugSchema,
          label: textSchema,
          multiline: z.boolean().default(false),
        }),
      )
      .min(1)
      .max(8),
    recordLabelField: slugSchema,
  }),
]);

const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("static") }),
  z.object({ type: z.literal("records"), fieldId: slugSchema }),
]);

const questionBase = {
  id: slugSchema,
  label: textSchema,
  instructions: textSchema,
  target: targetSchema,
};

export const questionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...questionBase,
    kind: z.literal("choice"),
    criteria: z
      .record(slugSchema, textSchema)
      .refine(
        (value) => Object.keys(value).length >= 2,
        "Choice requires at least two options",
      )
      .refine(
        (value) => Object.keys(value).length <= definitionLimits.choiceOptions,
        `Choice supports at most ${definitionLimits.choiceOptions} options`,
      ),
  }),
  z.object({
    ...questionBase,
    kind: z.literal("score"),
    levels: z
      .array(z.object({ label: textSchema, description: textSchema }))
      .min(2)
      .max(definitionLimits.scoreLevels),
  }),
  z.object({
    ...questionBase,
    kind: z.literal("noul"),
    criteria: z.object({ true: textSchema, false: textSchema }),
  }),
]);

export const metricSourceSchema = z.object({
  questionId: slugSchema,
  signal: z.enum(["score", "confidence", "noul", "choiceProbability"]),
  option: slugSchema.optional(),
  aggregation: z.enum(["average", "minimum", "maximum"]).default("average"),
});

export const metricSchema = z.object({
  id: slugSchema,
  label: textSchema,
  source: metricSourceSchema,
  weight: z.number().finite().min(0).max(10).default(1),
  invert: z.boolean().default(false),
});

const numericConditionSchema = z.object({
  type: z.literal("metric"),
  metricId: slugSchema,
  operator: z.enum(["gte", "gt", "lte", "lt", "eq"]),
  value: z.number().finite().min(0).max(1),
});

const choiceConditionSchema = z.object({
  type: z.literal("selectedChoice"),
  questionId: slugSchema,
  operator: z.enum(["eq", "neq"]),
  value: slugSchema,
});

export const policyRuleSchema = z.object({
  id: slugSchema,
  label: textSchema,
  all: z
    .array(
      z.discriminatedUnion("type", [
        numericConditionSchema,
        choiceConditionSchema,
      ]),
    )
    .min(1)
    .max(12),
  outcome: z.enum(["act", "review", "stop"]),
  recommendation: textSchema,
});

export const experimentDefinitionSchema = z
  .object({
    version: z.literal(EXPERIMENT_VERSION),
    id: slugSchema,
    title: textSchema,
    eyebrow: z.string().trim().min(1).max(40),
    description: z.string().trim().min(1).max(1_000),
    accent: z.enum(["coral", "sky", "lavender", "moss", "ink", "gold"]),
    simulatedAction: z.string().trim().min(1).max(1_000),
    fields: z.array(stateFieldSchema).min(1).max(16),
    sampleState: z.record(z.unknown()),
    questions: z.array(questionSchema).min(1).max(definitionLimits.questions),
    policy: z.object({
      metrics: z.array(metricSchema).max(24),
      rules: z.array(policyRuleSchema).min(1).max(16),
      fallback: z.object({
        outcome: z.enum(["act", "review", "stop"]),
        recommendation: textSchema,
      }),
    }),
    ranking: z
      .object({
        fieldId: slugSchema,
        label: textSchema,
        metrics: z.array(slugSchema).min(1).max(12),
      })
      .optional(),
  })
  .superRefine((definition, context) => {
    const fieldIds = new Set<string>();
    for (const field of definition.fields) {
      if (fieldIds.has(field.id))
        context.addIssue({
          code: "custom",
          path: ["fields"],
          message: `Duplicate field id: ${field.id}`,
        });
      fieldIds.add(field.id);
      if (field.type === "records" && field.minItems > field.maxItems)
        context.addIssue({
          code: "custom",
          path: ["fields", field.id],
          message: "minItems cannot exceed maxItems",
        });
    }
    const questionIds = new Set<string>();
    for (const question of definition.questions) {
      if (questionIds.has(question.id))
        context.addIssue({
          code: "custom",
          path: ["questions"],
          message: `Duplicate question id: ${question.id}`,
        });
      questionIds.add(question.id);
      if (
        question.target.type === "records" &&
        !fieldIds.has(question.target.fieldId)
      )
        context.addIssue({
          code: "custom",
          path: ["questions", question.id, "target"],
          message: `Unknown record field: ${question.target.fieldId}`,
        });
    }
    const metricIds = new Set<string>();
    for (const metric of definition.policy.metrics) {
      if (metricIds.has(metric.id))
        context.addIssue({
          code: "custom",
          path: ["policy", "metrics"],
          message: `Duplicate metric id: ${metric.id}`,
        });
      metricIds.add(metric.id);
      const question = definition.questions.find(
        (candidate) => candidate.id === metric.source.questionId,
      );
      if (!question)
        context.addIssue({
          code: "custom",
          path: ["policy", "metrics", metric.id],
          message: `Unknown question: ${metric.source.questionId}`,
        });
      if (
        metric.source.signal === "choiceProbability" &&
        (!metric.source.option || question?.kind !== "choice")
      )
        context.addIssue({
          code: "custom",
          path: ["policy", "metrics", metric.id],
          message:
            "Choice probability metrics require a Choice question and option",
        });
    }
    for (const rule of definition.policy.rules) {
      for (const condition of rule.all) {
        if (condition.type === "metric" && !metricIds.has(condition.metricId))
          context.addIssue({
            code: "custom",
            path: ["policy", "rules", rule.id],
            message: `Unknown metric: ${condition.metricId}`,
          });
        if (
          condition.type === "selectedChoice" &&
          !questionIds.has(condition.questionId)
        )
          context.addIssue({
            code: "custom",
            path: ["policy", "rules", rule.id],
            message: `Unknown question: ${condition.questionId}`,
          });
      }
    }
    if (JSON.stringify(definition).length > definitionLimits.definitionBytes)
      context.addIssue({
        code: "custom",
        path: [],
        message: "Definition is too large",
      });
  });

export type StateField = z.infer<typeof stateFieldSchema>;
export type QuestionDefinition = z.infer<typeof questionSchema>;
export type MetricDefinition = z.infer<typeof metricSchema>;
export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type ExperimentDefinitionV1 = z.infer<typeof experimentDefinitionSchema>;
export type ExperimentState = Record<string, unknown>;

export type ExpandedQuestion = QuestionDefinition & {
  expandedId: string;
  baseQuestionId: string;
  recordIndex?: number;
  recordLabel?: string;
};

export function validateExperimentState(
  definition: ExperimentDefinitionV1,
  state: ExperimentState,
) {
  if (JSON.stringify(state).length > definitionLimits.stateBytes)
    throw new Error("Experiment state is too large");
  for (const field of definition.fields) {
    const value = state[field.id];
    if (field.type === "records") {
      if (!Array.isArray(value))
        throw new Error(`${field.label} must be a record list`);
      if (value.length < field.minItems || value.length > field.maxItems)
        throw new Error(
          `${field.label} must contain ${field.minItems}-${field.maxItems} records`,
        );
      for (const record of value) {
        if (!record || typeof record !== "object" || Array.isArray(record))
          throw new Error(`${field.label} contains an invalid record`);
      }
    } else if (
      field.required &&
      (value === undefined ||
        value === null ||
        (typeof value === "string" && !value.trim()))
    ) {
      throw new Error(`Missing input: ${field.label}`);
    }
    if (field.type === "json" && typeof value !== "object")
      throw new Error(`${field.label} must be valid JSON`);
  }
  return state;
}

export function expandQuestions(
  definition: ExperimentDefinitionV1,
  state: ExperimentState,
): ExpandedQuestion[] {
  validateExperimentState(definition, state);
  const expanded = definition.questions.flatMap<ExpandedQuestion>(
    (question) => {
      if (question.target.type === "static")
        return [
          { ...question, expandedId: question.id, baseQuestionId: question.id },
        ];
      const fieldId = question.target.fieldId;
      const field = definition.fields.find(
        (candidate) => candidate.id === fieldId,
      );
      const records = state[fieldId] as Array<Record<string, unknown>>;
      const labelField =
        field?.type === "records" ? field.recordLabelField : "name";
      return records.map((record, recordIndex) => ({
        ...question,
        expandedId: `${question.id}__${recordIndex}`,
        baseQuestionId: question.id,
        recordIndex,
        recordLabel: String(record[labelField] ?? `Record ${recordIndex + 1}`),
      }));
    },
  );
  if (expanded.length > definitionLimits.questions)
    throw new Error(
      `Expanded experiment exceeds ${definitionLimits.questions} questions`,
    );
  return expanded;
}

export const experiments = rawDefinitions.map((definition) =>
  experimentDefinitionSchema.parse(definition),
);
export const experimentRegistry = Object.fromEntries(
  experiments.map((definition) => [definition.id, definition]),
);
export function getExperiment(id: string) {
  const definition = experimentRegistry[id];
  if (!definition) throw new Error(`Unknown experiment: ${id}`);
  return definition;
}

export const blankExperiment: ExperimentDefinitionV1 =
  experimentDefinitionSchema.parse({
    version: 1,
    id: "untitled-experiment",
    title: "Untitled experiment",
    eyebrow: "CUSTOM / 01",
    description: "A custom Jev decision experiment.",
    accent: "ink",
    simulatedAction: "Review the deterministic policy result.",
    fields: [
      {
        id: "context",
        type: "multiline",
        label: "Context",
        description: "Evidence supplied to the decision system.",
        required: true,
      },
    ],
    sampleState: { context: "Describe the evidence to evaluate." },
    questions: [
      {
        id: "supported",
        kind: "noul",
        target: { type: "static" },
        label: "Is the proposition supported?",
        instructions: "Is the proposition supported?",
        criteria: {
          true: "The supplied evidence supports the proposition.",
          false: "The supplied evidence does not support the proposition.",
        },
      },
    ],
    policy: {
      metrics: [
        {
          id: "support",
          label: "Support",
          source: {
            questionId: "supported",
            signal: "noul",
            aggregation: "average",
          },
          weight: 1,
          invert: false,
        },
      ],
      rules: [
        {
          id: "act",
          label: "Act on sufficient support",
          all: [
            {
              type: "metric",
              metricId: "support",
              operator: "gte",
              value: 0.75,
            },
          ],
          outcome: "act",
          recommendation: "Proceed with the configured simulated action.",
        },
      ],
      fallback: {
        outcome: "review",
        recommendation: "Review the evidence before acting.",
      },
    },
  });
