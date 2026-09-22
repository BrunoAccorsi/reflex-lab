import {
  blankExperiment,
  experiments,
  type ExperimentDefinitionV1,
  type ExperimentState,
  type QuestionDefinition,
  type StateField,
} from "@/lib/experiments";
import englishLocale from "@/locales/en.json";
import portugueseLocale from "@/locales/pt-BR.json";

export type Language = "en" | "pt-BR";

type FieldCopy = {
  label: string;
  description: string;
  columns?: Record<string, string>;
};

type QuestionCopy = {
  label: string;
  instructions: string;
  criteria?: Record<string, string>;
  levels?: Array<{ label: string; description: string }>;
};

type DefinitionCopy = {
  title: string;
  description: string;
  simulatedAction: string;
  fields: Record<string, FieldCopy>;
  sampleState: ExperimentState;
  questions: Record<string, QuestionCopy>;
  metrics: Record<string, string>;
  rules: Record<string, { label: string; recommendation: string }>;
  fallback: string;
  ranking?: string;
};

const ui: Record<Language, typeof englishLocale> = {
  en: englishLocale,
  "pt-BR": portugueseLocale.ui,
};

const definitionTranslations: Record<string, DefinitionCopy> =
  portugueseLocale.definitions;
const valueTranslations: Record<string, string> = portugueseLocale.values;

export function getCopy(language: Language) {
  return (key: keyof typeof englishLocale) => ui[language][key];
}

function localizeField(field: StateField, copy?: FieldCopy): StateField {
  if (!copy) return field;

  if (field.type === "records") {
    return {
      ...field,
      label: copy.label,
      description: copy.description,
      columns: field.columns.map((column) => ({
        ...column,
        label: copy.columns?.[column.id] ?? column.label,
      })),
    };
  }

  return { ...field, label: copy.label, description: copy.description };
}

function localizeQuestion(
  question: QuestionDefinition,
  copy?: QuestionCopy,
): QuestionDefinition {
  if (!copy) return question;

  const labels = { label: copy.label, instructions: copy.instructions };
  switch (question.kind) {
    case "choice":
      return {
        ...question,
        ...labels,
        criteria: copy.criteria ?? question.criteria,
      };
    case "score":
      return { ...question, ...labels, levels: copy.levels ?? question.levels };
    case "noul":
      return {
        ...question,
        ...labels,
        criteria: {
          true: copy.criteria?.true ?? question.criteria.true,
          false: copy.criteria?.false ?? question.criteria.false,
        },
      };
  }
}

export function localizeDefinition(
  definition: ExperimentDefinitionV1,
  language: Language,
): ExperimentDefinitionV1 {
  const copy =
    language === "pt-BR" ? definitionTranslations[definition.id] : undefined;
  if (!copy) return definition;

  return {
    ...definition,
    title: copy.title,
    description: copy.description,
    simulatedAction: copy.simulatedAction,
    fields: definition.fields.map((field) =>
      localizeField(field, copy.fields[field.id]),
    ),
    sampleState: copy.sampleState,
    questions: definition.questions.map((question) =>
      localizeQuestion(question, copy.questions[question.id]),
    ),
    policy: {
      ...definition.policy,
      metrics: definition.policy.metrics.map((metric) => ({
        ...metric,
        label: copy.metrics[metric.id] ?? metric.label,
      })),
      rules: definition.policy.rules.map((rule) => ({
        ...rule,
        label: copy.rules[rule.id]?.label ?? rule.label,
        recommendation:
          copy.rules[rule.id]?.recommendation ?? rule.recommendation,
      })),
      fallback: {
        ...definition.policy.fallback,
        recommendation: copy.fallback,
      },
    },
    ranking: definition.ranking
      ? {
          ...definition.ranking,
          label: copy.ranking ?? definition.ranking.label,
        }
      : undefined,
  };
}

export function localizedExperiments(language: Language) {
  return experiments.map((definition) =>
    localizeDefinition(definition, language),
  );
}

export function localizedBlankExperiment(language: Language) {
  return localizeDefinition(blankExperiment, language);
}

export function languageLabel(language: Language) {
  return ui[language].selectedLanguage;
}

export function localizeValue(value: string, language: Language) {
  if (language === "en") return value;
  return valueTranslations[value] ?? value;
}

export function localizedKind(
  kind: QuestionDefinition["kind"],
  language: Language,
) {
  const key = {
    choice: "kindChoice",
    score: "kindScore",
    noul: "kindNoul",
  } as const;
  return getCopy(language)(key[kind]);
}

export function localizedOutcome(
  outcome: "act" | "review" | "stop",
  language: Language,
) {
  const copy = getCopy(language);
  return copy(outcome);
}
