"use client";

import { Braces, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import {
  type ExperimentDefinitionV1,
  type MetricDefinition,
  type PolicyRule,
  type QuestionDefinition,
  type StateField,
} from "@/lib/experiments";
import { useLanguage } from "@/components/language-toggle";
import { createId } from "@/lib/ids";
import { Button } from "@/components/ui/button";
import { StudioQuestionOptions } from "@/components/studio-question-options";
import { JsonEditor } from "@/components/json-code";
import { StudioRequestPreview } from "@/components/studio-request-preview";

export type EditorTab =
  "Definition" | "Questions" | "Policy" | "JSON" | "Template JSON";

type StudioEditorPanelsProps = {
  tab: EditorTab;
  model: string;
  requestStateText: string;
  requestStateError: string | null;
  updateRequestState: (text: string) => void;
  definition: ExperimentDefinitionV1;
  jsonText: string;
  errors: string[];
  update: (next: ExperimentDefinitionV1) => void;
  updateJson: (text: string) => void;
};

function replaceAt<T>(items: T[], index: number, replacement: T): T[] {
  return items.map((item, itemIndex) =>
    itemIndex === index ? replacement : item,
  );
}

function EditorChoice({
  label,
  accessibleLabel = label,
  value,
  options,
  onChange,
  help,
  emptyMessage,
}: {
  label: string;
  accessibleLabel?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  help?: string;
  emptyMessage?: string;
}) {
  const { t } = useLanguage();
  const helpId = useId();
  const selected = options.find((option) => option.value === value);
  const unavailable = `${t("unavailable")}: ${value}`;
  const hint = options.length === 0 ? emptyMessage : help;

  return (
    <label className="min-w-0 text-sm">
      <span className="mb-2 block text-xs font-bold text-ink/60">{label}</span>
      {options.length > 0 && (options.length > 1 || !selected) ? (
        <select
          aria-label={accessibleLabel}
          aria-describedby={hint ? helpId : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-ink/10 bg-paper p-3 text-sm"
        >
          {!selected && (
            <option value={value} disabled>
              {unavailable}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <output
          aria-label={accessibleLabel}
          aria-describedby={hint ? helpId : undefined}
          className="block break-words rounded-xl bg-paper p-3 text-sm text-ink/70"
        >
          {selected?.label ?? unavailable}
        </output>
      )}
      {hint && (
        <span id={helpId} className="mt-2 block text-xs leading-5 text-ink/50">
          {hint}
        </span>
      )}
    </label>
  );
}

export function StudioEditorPanels({
  tab,
  model,
  requestStateText,
  requestStateError,
  updateRequestState,
  definition,
  jsonText,
  errors,
  update,
  updateJson,
}: StudioEditorPanelsProps) {
  const { t } = useLanguage();
  const recordFields = definition.fields.filter(
    (field) => field.type === "records",
  );

  function editQuestion(index: number, next: QuestionDefinition) {
    update({
      ...definition,
      questions: replaceAt(definition.questions, index, next),
    });
  }
  function renameOption(index: number, previous: string, next: string) {
    const question = definition.questions[index];
    if (question.kind !== "choice" || previous === next) return;
    update({
      ...definition,
      questions: replaceAt(definition.questions, index, {
        ...question,
        criteria: Object.fromEntries(
          Object.entries(question.criteria).map(([value, criterion]) => [
            value === previous ? next : value,
            criterion,
          ]),
        ),
      }),
      policy: {
        ...definition.policy,
        metrics: definition.policy.metrics.map((metric) =>
          metric.source.questionId === question.id &&
          metric.source.option === previous
            ? { ...metric, source: { ...metric.source, option: next } }
            : metric,
        ),
        rules: definition.policy.rules.map((rule) => ({
          ...rule,
          all: rule.all.map((condition) =>
            condition.type === "selectedChoice" &&
            condition.questionId === question.id &&
            condition.value === previous
              ? { ...condition, value: next }
              : condition,
          ),
        })),
      },
    });
  }
  function editField(index: number, next: StateField) {
    update({
      ...definition,
      fields: replaceAt(definition.fields, index, next),
    });
  }
  function editMetric(index: number, next: MetricDefinition) {
    update({
      ...definition,
      policy: {
        ...definition.policy,
        metrics: replaceAt(definition.policy.metrics, index, next),
      },
    });
  }
  function editRule(index: number, next: PolicyRule) {
    update({
      ...definition,
      policy: {
        ...definition.policy,
        rules: replaceAt(definition.policy.rules, index, next),
      },
    });
  }
  function addQuestion(kind: QuestionDefinition["kind"]) {
    const id = createId(kind);
    const target = { type: "static" as const };
    const next: QuestionDefinition =
      kind === "choice"
        ? {
            id,
            kind,
            target,
            label: t("newChoice"),
            instructions: t("chooseBest"),
            criteria: { optionA: t("evidenceA"), optionB: t("evidenceB") },
          }
        : kind === "score"
          ? {
              id,
              kind,
              target,
              label: t("newScore"),
              instructions: t("closestLevel"),
              levels: [
                {
                  label: t("low"),
                  description: t("littleEvidence"),
                },
                {
                  label: t("high"),
                  description: t("strongEvidence"),
                },
              ],
            }
          : {
              id,
              kind,
              target,
              label: t("newYesNo"),
              instructions: t("determineSupported"),
              criteria: {
                true: t("evidenceSupportsYes"),
                false: t("evidenceSupportsNo"),
              },
            };
    update({ ...definition, questions: [...definition.questions, next] });
  }

  return (
    <>
      {tab === "Definition" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              {t("title")}
              <input
                value={definition.title}
                onChange={(event) =>
                  update({ ...definition, title: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-ink/10 bg-paper p-3 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              {t("identifier")}
              <input
                value={definition.id}
                onChange={(event) =>
                  update({ ...definition, id: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-ink/10 bg-paper p-3 font-mono text-xs font-normal"
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              {t("description")}
              <textarea
                value={definition.description}
                onChange={(event) =>
                  update({
                    ...definition,
                    description: event.target.value,
                  })
                }
                className="mt-2 min-h-24 w-full rounded-xl border border-ink/10 bg-paper p-3 font-normal"
              />
            </label>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black">{t("stateFields")}</h2>
              <Button
                onClick={() =>
                  update({
                    ...definition,
                    fields: [
                      ...definition.fields,
                      {
                        id: createId("field"),
                        type: "multiline",
                        label: t("newField"),
                        description: "",
                        required: true,
                      },
                    ],
                  })
                }
                className="border border-ink/10"
              >
                <Plus size={14} className="mr-2" /> {t("addField")}
              </Button>
            </div>
            <div className="space-y-3">
              {/* Keep row identity independent of the editable field identifier. */}
              {definition.fields.map((field, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-record"
                >
                  <input
                    aria-label={`${t("fieldType")} ${index + 1} ${t("identifier")}`}
                    value={field.id}
                    onChange={(event) =>
                      editField(index, {
                        ...field,
                        id: event.target.value,
                      })
                    }
                    className="rounded-lg border border-ink/10 bg-white p-2 font-mono text-xs"
                  />
                  <input
                    aria-label={`${t("fieldType")} ${index + 1} ${t("title")}`}
                    value={field.label}
                    onChange={(event) =>
                      editField(index, {
                        ...field,
                        label: event.target.value,
                      })
                    }
                    className="rounded-lg border border-ink/10 bg-white p-2 text-sm"
                  />
                  <select
                    aria-label={`${t("fieldType")} ${index + 1}`}
                    value={field.type}
                    onChange={(event) => {
                      const type = event.target.value;
                      const base = {
                        id: field.id,
                        label: field.label,
                        description: field.description,
                        required: field.required,
                      };
                      const next =
                        type === "records"
                          ? {
                              ...base,
                              type: "records" as const,
                              minItems: 1,
                              maxItems: 6,
                              recordLabelField: "name",
                              columns: [
                                {
                                  id: "name",
                                  label: t("columnName"),
                                  multiline: false,
                                },
                              ],
                            }
                          : {
                              ...base,
                              type: type as "text" | "multiline" | "json",
                            };
                      editField(index, next);
                    }}
                    className="rounded-lg border border-ink/10 bg-white p-2 text-sm"
                  >
                    <option value="text">{t("text")}</option>
                    <option value="multiline">{t("multiline")}</option>
                    <option value="json">JSON</option>
                    <option value="records">{t("records")}</option>
                  </select>
                  <button
                    aria-label={`${t("removeField")} ${index + 1}`}
                    onClick={() =>
                      update({
                        ...definition,
                        fields: definition.fields.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === "Questions" && (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-black">{t("atomicQuestions")}</h2>
              <p className="mt-1 text-sm text-ink/45">{t("staticQuestions")}</p>
            </div>
            <div className="flex gap-2">
              {(["choice", "score", "noul"] as const).map((kind) => (
                <Button
                  key={kind}
                  onClick={() => addQuestion(kind)}
                  className="border border-ink/10"
                >
                  <Plus size={13} className="mr-1" />{" "}
                  {kind === "choice"
                    ? t("kindChoice")
                    : kind === "score"
                      ? t("kindScore")
                      : t("kindNoul")}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {definition.questions.map((question, index) => (
              <div
                key={`${question.id}-${index}`}
                className="rounded-2xl border border-ink/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-paper px-2 py-1 text-xs font-black uppercase">
                      {question.kind === "choice"
                        ? t("kindChoice")
                        : question.kind === "score"
                          ? t("kindScore")
                          : t("kindNoul")}
                    </span>
                    <span className="ml-2 font-mono text-xs text-ink/40">
                      {question.id}
                    </span>
                  </div>
                  <button
                    aria-label={`${t("removeQuestion")} ${question.label}`}
                    onClick={() =>
                      update({
                        ...definition,
                        questions: definition.questions.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-sm">
                    <span className="mb-2 block text-xs font-bold text-ink/60">
                      {t("title")}
                    </span>
                    <input
                      aria-label={`${t("questions")} ${index + 1} ${t("title")}`}
                      value={question.label}
                      onChange={(event) =>
                        editQuestion(index, {
                          ...question,
                          label: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-ink/10 bg-paper p-3 text-sm font-bold"
                    />
                  </label>
                  <EditorChoice
                    label={t("runMode")}
                    accessibleLabel={`${t("questions")} ${index + 1} ${t("runMode")}`}
                    value={
                      question.target.type === "static"
                        ? "static"
                        : question.target.fieldId
                    }
                    onChange={(value) =>
                      editQuestion(index, {
                        ...question,
                        target:
                          value === "static"
                            ? { type: "static" }
                            : {
                                type: "records",
                                fieldId: value,
                              },
                      })
                    }
                    options={[
                      { value: "static", label: t("runsOnce") },
                      ...recordFields.map((field) => ({
                        value: field.id,
                        label: `${t("repeat")}: ${field.label}`,
                      })),
                    ]}
                    help={
                      recordFields.length === 0
                        ? t("addRecordsForRepeat")
                        : undefined
                    }
                  />
                  <label className="min-w-0 text-sm sm:col-span-2">
                    <span className="mb-2 block text-xs font-bold text-ink/60">
                      {t("questionInstructions")}
                    </span>
                    <textarea
                      aria-label={`${t("questions")} ${index + 1} ${t("instructions")}`}
                      value={question.instructions}
                      onChange={(event) =>
                        editQuestion(index, {
                          ...question,
                          instructions: event.target.value,
                        })
                      }
                      className="min-h-20 w-full rounded-xl border border-ink/10 bg-paper p-3 text-sm"
                    />
                  </label>
                </div>
                {(question.kind === "choice" || question.kind === "score") && (
                  <StudioQuestionOptions
                    question={question}
                    onChange={(next) => editQuestion(index, next)}
                    onRenameOption={(previous, next) =>
                      renameOption(index, previous, next)
                    }
                    protectedOptions={[
                      ...definition.policy.metrics
                        .filter(
                          (metric) =>
                            metric.source.questionId === question.id &&
                            metric.source.signal === "choiceProbability",
                        )
                        .flatMap((metric) =>
                          metric.source.option ? [metric.source.option] : [],
                        ),
                      ...definition.policy.rules.flatMap((rule) =>
                        rule.all.flatMap((condition) =>
                          condition.type === "selectedChoice" &&
                          condition.questionId === question.id
                            ? [condition.value]
                            : [],
                        ),
                      ),
                    ]}
                  />
                )}
                {question.kind === "noul" && (
                  <div className="mt-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        aria-label={`${question.label} ${t("useNoulCriteria")}`}
                        checked={Boolean(question.criteria)}
                        onChange={(event) =>
                          editQuestion(index, {
                            ...question,
                            criteria: event.target.checked
                              ? {
                                  true: t("evidenceSupportsYes"),
                                  false: t("evidenceSupportsNo"),
                                }
                              : undefined,
                          })
                        }
                      />
                      {t("useNoulCriteria")}
                    </label>
                    <p className="text-xs leading-5 text-ink/50">
                      {t("noulCriteriaHelp")}
                    </p>
                    {question.criteria && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="min-w-0 text-xs font-bold text-ink/60">
                          <span className="mb-2 block">{t("yesCriteria")}</span>
                          <textarea
                            aria-label={`${question.label} true criteria`}
                            value={question.criteria.true}
                            onChange={(event) =>
                              editQuestion(index, {
                                ...question,
                                criteria: {
                                  true: event.target.value,
                                  false:
                                    question.criteria?.false ??
                                    t("evidenceSupportsNo"),
                                },
                              })
                            }
                            className="min-h-20 w-full rounded-lg border border-moss/20 bg-moss/5 p-2 text-sm font-normal text-ink"
                          />
                        </label>
                        <label className="min-w-0 text-xs font-bold text-ink/60">
                          <span className="mb-2 block">{t("noCriteria")}</span>
                          <textarea
                            aria-label={`${question.label} false criteria`}
                            value={question.criteria.false}
                            onChange={(event) =>
                              editQuestion(index, {
                                ...question,
                                criteria: {
                                  true:
                                    question.criteria?.true ??
                                    t("evidenceSupportsYes"),
                                  false: event.target.value,
                                },
                              })
                            }
                            className="min-h-20 w-full rounded-lg border border-coral/20 bg-coral/5 p-2 text-sm font-normal text-ink"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "Policy" && (
        <div className="space-y-7">
          <div>
            <h2 className="font-black">{t("weightedMetrics")}</h2>
            <p className="mt-1 text-sm text-ink/45">
              {t("weightedMetricsHelp")}
            </p>
            <div className="mt-4 space-y-3">
              {definition.policy.metrics.map((metric, index) => (
                <div
                  key={metric.id}
                  className="grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-policy"
                >
                  <label className="min-w-0 text-sm">
                    <span className="mb-2 block text-xs font-bold text-ink/60">
                      {t("title")}
                    </span>
                    <input
                      value={metric.label}
                      onChange={(event) =>
                        editMetric(index, {
                          ...metric,
                          label: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-ink/10 bg-paper p-3 text-sm font-bold"
                    />
                  </label>
                  <EditorChoice
                    label={t("sourceQuestion")}
                    accessibleLabel={`${t("sourceQuestion")} ${index + 1}`}
                    value={metric.source.questionId}
                    onChange={(value) =>
                      editMetric(index, {
                        ...metric,
                        source: {
                          ...metric.source,
                          questionId: value,
                        },
                      })
                    }
                    options={definition.questions.map((question) => ({
                      value: question.id,
                      label: question.label,
                    }))}
                    emptyMessage={t("addQuestionForSource")}
                  />
                  <label className="min-w-0 text-sm">
                    <span className="mb-2 block text-xs font-bold text-ink/60">
                      {t("weight")}
                    </span>
                    <input
                      aria-label={`${metric.label} weight`}
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={metric.weight}
                      onChange={(event) =>
                        editMetric(index, {
                          ...metric,
                          weight: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-xl border border-ink/10 bg-paper p-3 text-sm"
                    />
                  </label>
                  <button
                    aria-label={`${t("removeMetric")} ${metric.label}`}
                    onClick={() =>
                      update({
                        ...definition,
                        policy: {
                          ...definition.policy,
                          metrics: definition.policy.metrics.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        },
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-black">{t("orderedOutcomeRules")}</h2>
            <div className="mt-4 space-y-3">
              {definition.policy.rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-ink/10 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-rule">
                    <input
                      value={rule.label}
                      onChange={(event) =>
                        editRule(index, {
                          ...rule,
                          label: event.target.value,
                        })
                      }
                      className="rounded-lg border border-ink/10 bg-paper p-2 font-bold"
                    />
                    <select
                      value={rule.outcome}
                      onChange={(event) =>
                        editRule(index, {
                          ...rule,
                          outcome: event.target.value as PolicyRule["outcome"],
                        })
                      }
                      className="rounded-lg border border-ink/10 bg-paper p-2"
                    >
                      <option value="act">{t("act")}</option>
                      <option value="review">{t("review")}</option>
                      <option value="stop">{t("stop")}</option>
                    </select>
                  </div>
                  <textarea
                    value={rule.recommendation}
                    onChange={(event) =>
                      editRule(index, {
                        ...rule,
                        recommendation: event.target.value,
                      })
                    }
                    className="mt-3 min-h-16 w-full rounded-lg border border-ink/10 bg-paper p-2 text-sm"
                  />
                  {rule.all.map((condition, conditionIndex) => (
                    <div
                      key={conditionIndex}
                      className="mt-2 flex items-center gap-3 rounded-lg bg-paper p-3 text-xs"
                    >
                      <span className="flex-1 font-mono">
                        {condition.type === "metric"
                          ? condition.metricId
                          : condition.questionId}{" "}
                        · {condition.operator}
                      </span>
                      {condition.type === "metric" ? (
                        <input
                          aria-label={`${rule.label} ${t("threshold")} ${conditionIndex + 1}`}
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={condition.value}
                          onChange={(event) =>
                            editRule(index, {
                              ...rule,
                              all: replaceAt(rule.all, conditionIndex, {
                                ...condition,
                                value: Number(event.target.value),
                              }),
                            })
                          }
                          className="w-20 rounded border border-ink/10 bg-white p-1"
                        />
                      ) : (
                        <span>{condition.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === "JSON" && (
        <StudioRequestPreview
          definition={definition}
          model={model}
          stateText={requestStateText}
          stateError={requestStateError}
          updateState={updateRequestState}
        />
      )}
      {tab === "Template JSON" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Braces size={17} />
            <h2 className="font-black">{t("fullDefinitionJson")}</h2>
          </div>
          <JsonEditor
            label={t("experimentDefinitionJson")}
            value={jsonText}
            onChange={updateJson}
          />
          {errors.length > 0 && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-coral/30 bg-coral/10 p-4"
            >
              <p className="font-black text-coral">{t("definitionErrors")}</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-danger-foreground">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
