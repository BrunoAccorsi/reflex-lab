"use client";

import { Braces, Plus, Trash2 } from "lucide-react";
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

export type EditorTab = "Definition" | "Questions" | "Policy" | "JSON";

type StudioEditorPanelsProps = {
  tab: EditorTab;
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

export function StudioEditorPanels({
  tab,
  definition,
  jsonText,
  errors,
  update,
  updateJson,
}: StudioEditorPanelsProps) {
  const { t } = useLanguage();

  function editQuestion(index: number, next: QuestionDefinition) {
    update({
      ...definition,
      questions: replaceAt(definition.questions, index, next),
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
              {definition.fields.map((field, index) => (
                <div
                  key={`${field.id}-${index}`}
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
                    ? t("choice")
                    : kind === "score"
                      ? t("score")
                      : t("noul")}
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
                        ? t("choice")
                        : question.kind === "score"
                          ? t("score")
                          : t("noul")}
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
                  <input
                    aria-label={`${t("questions")} ${index + 1} ${t("title")}`}
                    value={question.label}
                    onChange={(event) =>
                      editQuestion(index, {
                        ...question,
                        label: event.target.value,
                      })
                    }
                    className="rounded-xl border border-ink/10 bg-paper p-3 text-sm font-bold"
                  />
                  <select
                    aria-label={`${t("questions")} ${index + 1} ${t("action")}`}
                    value={
                      question.target.type === "static"
                        ? "static"
                        : question.target.fieldId
                    }
                    onChange={(event) =>
                      editQuestion(index, {
                        ...question,
                        target:
                          event.target.value === "static"
                            ? { type: "static" }
                            : {
                                type: "records",
                                fieldId: event.target.value,
                              },
                      })
                    }
                    className="rounded-xl border border-ink/10 bg-paper p-3 text-sm"
                  >
                    <option value="static">{t("static")}</option>
                    {definition.fields
                      .filter((field) => field.type === "records")
                      .map((field) => (
                        <option key={field.id} value={field.id}>
                          {t("repeat")}: {field.label}
                        </option>
                      ))}
                  </select>
                  <textarea
                    aria-label={`${t("questions")} ${index + 1} ${t("instructions")}`}
                    value={question.instructions}
                    onChange={(event) =>
                      editQuestion(index, {
                        ...question,
                        instructions: event.target.value,
                      })
                    }
                    className="min-h-20 rounded-xl border border-ink/10 bg-paper p-3 text-sm sm:col-span-2"
                  />
                </div>
                {question.kind === "choice" && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(question.criteria).map(
                      ([option, criterion]) => (
                        <div
                          key={option}
                          className="grid gap-2 sm:grid-cols-question"
                        >
                          <input
                            value={option}
                            readOnly
                            className="rounded-lg border border-ink/10 bg-paper p-2 font-mono text-xs"
                          />
                          <input
                            value={criterion}
                            onChange={(event) =>
                              editQuestion(index, {
                                ...question,
                                criteria: {
                                  ...question.criteria,
                                  [option]: event.target.value,
                                },
                              })
                            }
                            className="rounded-lg border border-ink/10 p-2 text-sm"
                          />
                        </div>
                      ),
                    )}
                  </div>
                )}
                {question.kind === "score" && (
                  <div className="mt-3 space-y-2">
                    {question.levels.map((level, levelIndex) => (
                      <div
                        key={levelIndex}
                        className="grid gap-2 sm:grid-cols-question"
                      >
                        <input
                          value={level.label}
                          onChange={(event) =>
                            editQuestion(index, {
                              ...question,
                              levels: question.levels.map((item, itemIndex) =>
                                itemIndex === levelIndex
                                  ? {
                                      ...item,
                                      label: event.target.value,
                                    }
                                  : item,
                              ),
                            })
                          }
                          className="rounded-lg border border-ink/10 bg-paper p-2 text-sm font-bold"
                        />
                        <input
                          value={level.description}
                          onChange={(event) =>
                            editQuestion(index, {
                              ...question,
                              levels: question.levels.map((item, itemIndex) =>
                                itemIndex === levelIndex
                                  ? {
                                      ...item,
                                      description: event.target.value,
                                    }
                                  : item,
                              ),
                            })
                          }
                          className="rounded-lg border border-ink/10 p-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {question.kind === "noul" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <textarea
                      aria-label={`${question.label} true criteria`}
                      value={question.criteria.true}
                      onChange={(event) =>
                        editQuestion(index, {
                          ...question,
                          criteria: {
                            ...question.criteria,
                            true: event.target.value,
                          },
                        })
                      }
                      className="min-h-20 rounded-lg border border-moss/20 bg-moss/5 p-2 text-sm"
                    />
                    <textarea
                      aria-label={`${question.label} false criteria`}
                      value={question.criteria.false}
                      onChange={(event) =>
                        editQuestion(index, {
                          ...question,
                          criteria: {
                            ...question.criteria,
                            false: event.target.value,
                          },
                        })
                      }
                      className="min-h-20 rounded-lg border border-coral/20 bg-coral/5 p-2 text-sm"
                    />
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
                  <input
                    value={metric.label}
                    onChange={(event) =>
                      editMetric(index, {
                        ...metric,
                        label: event.target.value,
                      })
                    }
                    className="rounded-lg border border-ink/10 bg-white p-2 text-sm font-bold"
                  />
                  <select
                    value={metric.source.questionId}
                    onChange={(event) =>
                      editMetric(index, {
                        ...metric,
                        source: {
                          ...metric.source,
                          questionId: event.target.value,
                        },
                      })
                    }
                    className="rounded-lg border border-ink/10 bg-white p-2 text-sm"
                  >
                    {definition.questions.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.label}
                      </option>
                    ))}
                  </select>
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
                    className="rounded-lg border border-ink/10 bg-white p-2 text-sm"
                  />
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
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Braces size={17} />
            <h2 className="font-black">{t("fullDefinitionJson")}</h2>
          </div>
          <textarea
            aria-label={t("experimentDefinitionJson")}
            value={jsonText}
            onChange={(event) => updateJson(event.target.value)}
            spellCheck={false}
            className="min-h-editor w-full rounded-2xl bg-code p-5 font-mono text-xs leading-5 text-white outline-none"
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
