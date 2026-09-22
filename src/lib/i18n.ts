import { blankExperiment, experiments, type ExperimentDefinitionV1, type ExperimentState, type QuestionDefinition, type StateField } from "@/lib/experiments";
import englishLocale from "@/locales/en.json";
import portugueseLocale from "@/locales/pt-BR.json";

export type Language = "en" | "pt-BR";

type FieldCopy = { label: string; description: string; columns?: Record<string, string> };
type QuestionCopy = { label: string; instructions: string; criteria?: Record<string, string>; levels?: Array<{ label: string; description: string }> };
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

const ui: Record<Language, Record<string, string>> = {
  en: englishLocale,
  "pt-BR": portugueseLocale.ui,
};

const definitionTranslations = portugueseLocale.definitions as Record<string, DefinitionCopy>;


export function getCopy(language: Language) {
  return (key: string) => ui[language][key] ?? key;
}

export function localizeDefinition(definition: ExperimentDefinitionV1, language: Language): ExperimentDefinitionV1 {
  if (language === "en") return definition;
  const copy = definitionTranslations[definition.id];
  if (!copy) return definition;
  const fields = definition.fields.map((field) => {
    const fieldCopy = copy.fields[field.id];
    if (!fieldCopy) return field;
    const next: StateField = { ...field, label: fieldCopy.label, description: fieldCopy.description };
    if (next.type === "records" && fieldCopy.columns) next.columns = next.columns.map((column) => ({ ...column, label: fieldCopy.columns?.[column.id] ?? column.label }));
    return next;
  });
  const questions = definition.questions.map((question) => {
    const questionCopy = copy.questions[question.id];
    if (!questionCopy) return question;
    if (question.kind === "choice" && questionCopy.criteria) return { ...question, label: questionCopy.label, instructions: questionCopy.instructions, criteria: questionCopy.criteria };
    if (question.kind === "noul" && questionCopy.criteria) return { ...question, label: questionCopy.label, instructions: questionCopy.instructions, criteria: { true: questionCopy.criteria.true, false: questionCopy.criteria.false } };
    if (question.kind === "score" && questionCopy.levels) return { ...question, label: questionCopy.label, instructions: questionCopy.instructions, levels: questionCopy.levels };
    return { ...question, label: questionCopy.label, instructions: questionCopy.instructions };
  });
  return {
    ...definition,
    title: copy.title,
    description: copy.description,
    simulatedAction: copy.simulatedAction,
    fields,
    sampleState: copy.sampleState,
    questions,
    policy: {
      ...definition.policy,
      metrics: definition.policy.metrics.map((metric) => ({ ...metric, label: copy.metrics[metric.id] ?? metric.label })),
      rules: definition.policy.rules.map((rule) => ({ ...rule, label: copy.rules[rule.id]?.label ?? rule.label, recommendation: copy.rules[rule.id]?.recommendation ?? rule.recommendation })),
      fallback: { ...definition.policy.fallback, recommendation: copy.fallback },
    },
    ranking: definition.ranking ? { ...definition.ranking, label: copy.ranking ?? definition.ranking.label } : undefined,
  };
}

export function localizedExperiments(language: Language) {
  return experiments.map((definition) => localizeDefinition(definition, language));
}

export function localizedBlankExperiment(language: Language) {
  if (language === "en") return blankExperiment;
  return { ...blankExperiment, title: "Experimento sem título", description: "Um experimento de decisão Jev personalizado.", simulatedAction: "Revise o resultado determinístico da política.", fields: [{ id: "context", type: "multiline" as const, label: "Contexto", description: "Evidências fornecidas ao sistema de decisão.", required: true }], sampleState: { context: "Descreva as evidências a serem avaliadas." }, questions: [{ ...blankExperiment.questions[0], label: "A proposição é sustentada?", instructions: "A proposição é sustentada?", criteria: { true: "As evidências fornecidas sustentam a proposição.", false: "As evidências fornecidas não sustentam a proposição." } }], policy: { ...blankExperiment.policy, metrics: [{ ...blankExperiment.policy.metrics[0], label: "Suporte" }], rules: [{ ...blankExperiment.policy.rules[0], label: "Agir com suporte suficiente", recommendation: "Prossiga com a ação simulada configurada." }], fallback: { ...blankExperiment.policy.fallback, recommendation: "Revise as evidências antes de agir." } } };
}

export function languageLabel(language: Language) {
  return language === "en" ? "English" : "Português (Brasil)";
}

const valueTranslations: Record<string, string> = {
  billing: "cobrança", technical: "técnico", account: "conta", general: "geral", refund: "reembolso", troubleshoot: "solucionar", explain: "explicar", change: "alteração", calm: "calmo", concerned: "preocupado", frustrated: "frustrado", hostile: "hostil", proceed: "prosseguir", confirm: "confirmar", inspect: "inspecionar", stop: "parar",
};

export function localizeValue(value: string, language: Language) {
  return language === "pt-BR" ? valueTranslations[value] ?? value : value;
}

export function localizedKind(kind: QuestionDefinition["kind"], language: Language) {
  const copy = getCopy(language);
  return kind === "choice" ? copy("kindChoice") : kind === "score" ? copy("kindScore") : copy("kindNoul");
}

export function localizedOutcome(outcome: "act" | "review" | "stop", language: Language) {
  const copy = getCopy(language);
  return copy(outcome);
}
