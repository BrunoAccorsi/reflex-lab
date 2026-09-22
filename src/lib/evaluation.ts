import { z } from "zod";
import {
  experimentDefinitionSchema,
  type ExperimentDefinitionV1,
  type ExperimentState,
  type ExpandedQuestion,
  type MetricDefinition,
} from "@/lib/experiments";

export const evaluationInputSchema = z.object({
  definition: experimentDefinitionSchema,
  state: z.record(z.unknown()),
});
export type EvaluationInput = z.infer<typeof evaluationInputSchema>;

type AnswerBase = {
  id: string;
  baseQuestionId: string;
  label: string;
  instructions: string;
  recordIndex?: number;
  recordLabel?: string;
};
export type ChoiceAnswer = AnswerBase & {
  kind: "choice";
  selected: string;
  confidence: number;
  probabilities: Record<string, number>;
  criteria: Record<string, string>;
};
export type ScoreAnswer = AnswerBase & {
  kind: "score";
  rawScore: number;
  normalizedScore: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend: Array<{ index: number; label: string; description: string }>;
};
export type NoulAnswer = AnswerBase & {
  kind: "noul";
  probabilityYes: number;
  probabilityNo: number;
  criteria: { true: string; false: string };
};
export type TypedAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type ProviderTelemetry = {
  provider: "OpenRouter" | "Mock";
  model: string;
  requestId: string | null;
  latencyMs: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  cost: number | null;
};
export type ExperimentResult = {
  experimentId: string;
  answers: TypedAnswer[];
  telemetry: ProviderTelemetry;
  request: Record<string, unknown>;
  rawResponse: unknown;
};

export type MetricTrace = {
  id: string;
  label: string;
  values: number[];
  rawValue: number;
  effectiveValue: number;
  weight: number;
  contribution: number;
  source: MetricDefinition["source"];
};
export type ConditionTrace = {
  description: string;
  actual: number | string | null;
  expected: number | string;
  passed: boolean;
};
export type RuleTrace = {
  id: string;
  label: string;
  passed: boolean;
  conditions: ConditionTrace[];
  outcome: "act" | "review" | "stop";
  recommendation: string;
};
export type PolicyResult = {
  outcome: "act" | "review" | "stop";
  recommendation: string;
  matchedRuleId: string | null;
  score: number;
  metrics: MetricTrace[];
  rules: RuleTrace[];
};
export type RankingRow = {
  recordIndex: number;
  label: string;
  score: number;
  metrics: MetricTrace[];
};

export function normalizeDistribution(
  probabilities: Record<string, number>,
  expectedKeys?: string[],
) {
  const keys = expectedKeys ?? Object.keys(probabilities);
  if (keys.length === 0 || keys.some((key) => probabilities[key] === undefined))
    throw new Error("Malformed response: incomplete probability distribution");
  if (
    Object.values(probabilities).some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    throw new Error(
      "Malformed response: probabilities must be finite and non-negative",
    );
  const total = keys.reduce((sum, key) => sum + probabilities[key], 0);
  if (total <= 0)
    throw new Error(
      "Malformed response: probabilities must have a positive total",
    );
  return Object.fromEntries(
    keys.map((key) => [key, probabilities[key] / total]),
  );
}

export function normalizeTypedAnswer(
  question: ExpandedQuestion,
  value: unknown,
): TypedAnswer {
  const common: AnswerBase = {
    id: question.expandedId,
    baseQuestionId: question.baseQuestionId,
    label: question.label,
    instructions: question.instructions,
  };
  if (question.recordIndex !== undefined)
    common.recordIndex = question.recordIndex;
  if (question.recordLabel !== undefined)
    common.recordLabel = question.recordLabel;
  if (question.kind === "choice") {
    const parsed = z
      .object({
        choice: z.string(),
        probabilities: z.record(z.number()),
        confidence: z.number().min(0).max(1).optional(),
      })
      .passthrough()
      .parse(value);
    const options = Object.keys(question.criteria);
    if (!options.includes(parsed.choice))
      throw new Error(
        `Malformed response: choice "${parsed.choice}" is invalid for ${question.expandedId}`,
      );
    const probabilities = normalizeDistribution(parsed.probabilities, options);
    const winner = Object.entries(probabilities).sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0];
    if (winner !== parsed.choice)
      throw new Error(
        `Malformed response: selected choice must have the highest probability for ${question.expandedId}`,
      );
    return {
      ...common,
      kind: "choice",
      selected: parsed.choice,
      confidence: parsed.confidence ?? probabilities[parsed.choice],
      probabilities,
      criteria: question.criteria,
    };
  }
  if (question.kind === "score") {
    const parsed = z
      .object({
        score: z.number().finite(),
        probabilities: z.record(z.number()),
        confidence: z.number().min(0).max(1).optional(),
      })
      .passthrough()
      .parse(value);
    const max = question.levels.length - 1;
    if (parsed.score < 0 || parsed.score > max)
      throw new Error(
        `Malformed response: score is outside the configured legend for ${question.expandedId}`,
      );
    const probabilityKeys = question.levels.map((_, index) => String(index));
    const probabilities = normalizeDistribution(
      parsed.probabilities,
      probabilityKeys,
    );
    return {
      ...common,
      kind: "score",
      rawScore: parsed.score,
      normalizedScore: max === 0 ? 0 : parsed.score / max,
      confidence:
        parsed.confidence ?? Math.max(...Object.values(probabilities)),
      probabilities,
      legend: question.levels.map((level, index) => ({ index, ...level })),
    };
  }
  const parsed = z
    .object({ noul: z.number().finite().min(0).max(1) })
    .passthrough()
    .parse(value);
  return {
    ...common,
    kind: "noul",
    probabilityYes: parsed.noul,
    probabilityNo: 1 - parsed.noul,
    criteria: question.criteria,
  };
}

function signalValues(
  metric: MetricDefinition,
  answers: TypedAnswer[],
  recordIndex?: number,
) {
  return answers
    .filter(
      (answer) =>
        answer.baseQuestionId === metric.source.questionId &&
        (recordIndex === undefined || answer.recordIndex === recordIndex),
    )
    .map((answer) => {
      if (metric.source.signal === "score" && answer.kind === "score")
        return answer.normalizedScore;
      if (
        metric.source.signal === "confidence" &&
        (answer.kind === "score" || answer.kind === "choice")
      )
        return answer.confidence;
      if (metric.source.signal === "noul" && answer.kind === "noul")
        return answer.probabilityYes;
      if (
        metric.source.signal === "choiceProbability" &&
        answer.kind === "choice" &&
        metric.source.option
      )
        return answer.probabilities[metric.source.option];
      return undefined;
    })
    .filter((value): value is number => value !== undefined);
}

function aggregate(
  values: number[],
  method: MetricDefinition["source"]["aggregation"],
) {
  if (values.length === 0) return 0;
  if (method === "minimum") return Math.min(...values);
  if (method === "maximum") return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateMetrics(
  definition: ExperimentDefinitionV1,
  answers: TypedAnswer[],
  recordIndex?: number,
): MetricTrace[] {
  return definition.policy.metrics.map((metric) => {
    const values = signalValues(metric, answers, recordIndex);
    const rawValue = aggregate(values, metric.source.aggregation);
    const effectiveValue = metric.invert ? 1 - rawValue : rawValue;
    return {
      id: metric.id,
      label: metric.label,
      values,
      rawValue,
      effectiveValue,
      weight: metric.weight,
      contribution: effectiveValue * metric.weight,
      source: metric.source,
    };
  });
}

function compareNumeric(
  actual: number,
  operator: "gte" | "gt" | "lte" | "lt" | "eq",
  expected: number,
) {
  if (operator === "gte") return actual >= expected;
  if (operator === "gt") return actual > expected;
  if (operator === "lte") return actual <= expected;
  if (operator === "lt") return actual < expected;
  return Math.abs(actual - expected) < 0.00001;
}

export function evaluatePolicy(
  definition: ExperimentDefinitionV1,
  answers: TypedAnswer[],
): PolicyResult {
  const metrics = calculateMetrics(definition, answers);
  const rules: RuleTrace[] = definition.policy.rules.map((rule) => {
    const conditions = rule.all.map<ConditionTrace>((condition) => {
      if (condition.type === "metric") {
        const metric = metrics.find(
          (candidate) => candidate.id === condition.metricId,
        );
        const actual = metric?.effectiveValue ?? 0;
        return {
          description: `${metric?.label ?? condition.metricId} ${condition.operator} ${condition.value}`,
          actual,
          expected: condition.value,
          passed: compareNumeric(actual, condition.operator, condition.value),
        };
      }
      const answer = answers.find(
        (candidate) =>
          candidate.kind === "choice" &&
          candidate.baseQuestionId === condition.questionId,
      ) as ChoiceAnswer | undefined;
      const actual = answer?.selected ?? null;
      return {
        description: `${condition.questionId} ${condition.operator} ${condition.value}`,
        actual,
        expected: condition.value,
        passed:
          condition.operator === "eq"
            ? actual === condition.value
            : actual !== condition.value,
      };
    });
    return {
      id: rule.id,
      label: rule.label,
      conditions,
      passed: conditions.every((condition) => condition.passed),
      outcome: rule.outcome,
      recommendation: rule.recommendation,
    };
  });
  const matched = rules.find((rule) => rule.passed);
  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  return {
    outcome: matched?.outcome ?? definition.policy.fallback.outcome,
    recommendation:
      matched?.recommendation ?? definition.policy.fallback.recommendation,
    matchedRuleId: matched?.id ?? null,
    score:
      totalWeight > 0
        ? metrics.reduce((sum, metric) => sum + metric.contribution, 0) /
          totalWeight
        : 0,
    metrics,
    rules,
  };
}

export function calculateRanking(
  definition: ExperimentDefinitionV1,
  state: ExperimentState,
  answers: TypedAnswer[],
): RankingRow[] {
  if (!definition.ranking) return [];
  const records = state[definition.ranking.fieldId];
  if (!Array.isArray(records)) return [];
  const field = definition.fields.find(
    (candidate) => candidate.id === definition.ranking?.fieldId,
  );
  const labelField =
    field?.type === "records" ? field.recordLabelField : "name";
  return records
    .map((record, recordIndex) => {
      const metrics = calculateMetrics(definition, answers, recordIndex).filter(
        (metric) => definition.ranking?.metrics.includes(metric.id),
      );
      const totalWeight = metrics.reduce(
        (sum, metric) => sum + metric.weight,
        0,
      );
      return {
        recordIndex,
        label: String(
          (record as Record<string, unknown>)[labelField] ??
            `Record ${recordIndex + 1}`,
        ),
        score: totalWeight
          ? metrics.reduce((sum, metric) => sum + metric.contribution, 0) /
            totalWeight
          : 0,
        metrics,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export type AnswerDelta = {
  id: string;
  label: string;
  kind: TypedAnswer["kind"];
  previous: string | number | null;
  current: string | number;
  delta: number | null;
};
export function compareResults(
  current: ExperimentResult,
  previous: ExperimentResult | null,
): AnswerDelta[] {
  if (!previous || previous.experimentId !== current.experimentId) return [];
  return current.answers.map((answer) => {
    const before = previous.answers.find(
      (candidate) =>
        candidate.id === answer.id && candidate.kind === answer.kind,
    );
    if (answer.kind === "choice") {
      const oldProbability =
        before?.kind === "choice"
          ? (before.probabilities[answer.selected] ?? 0)
          : null;
      return {
        id: answer.id,
        label: answer.label,
        kind: answer.kind,
        previous: before?.kind === "choice" ? before.selected : null,
        current: answer.selected,
        delta:
          oldProbability === null
            ? null
            : answer.probabilities[answer.selected] - oldProbability,
      };
    }
    if (answer.kind === "score") {
      const old = before?.kind === "score" ? before.normalizedScore : null;
      return {
        id: answer.id,
        label: answer.label,
        kind: answer.kind,
        previous: old,
        current: answer.normalizedScore,
        delta: old === null ? null : answer.normalizedScore - old,
      };
    }
    const old = before?.kind === "noul" ? before.probabilityYes : null;
    return {
      id: answer.id,
      label: answer.label,
      kind: answer.kind,
      previous: old,
      current: answer.probabilityYes,
      delta: old === null ? null : answer.probabilityYes - old,
    };
  });
}
