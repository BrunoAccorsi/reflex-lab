"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { definitionLimits, type QuestionDefinition } from "@/lib/experiments";

type EditableQuestion = Extract<
  QuestionDefinition,
  { kind: "choice" | "score" }
>;

export function StudioQuestionOptions({
  question,
  onChange,
  protectedOptions = [],
  onRenameOption,
}: {
  question: EditableQuestion;
  onChange: (question: EditableQuestion) => void;
  protectedOptions?: string[];
  onRenameOption: (previous: string, next: string) => void;
}) {
  const { t } = useLanguage();
  const [optionError, setOptionError] = useState<string | null>(null);
  const [optionOrder, setOptionOrder] = useState<string[]>([]);

  if (question.kind === "choice") {
    // Numeric keys otherwise jump to the front of an object while being edited.
    const keys = Object.keys(question.criteria);
    const orderedKeys = [
      ...optionOrder.filter((key) => Object.hasOwn(question.criteria, key)),
      ...keys.filter((key) => !optionOrder.includes(key)),
    ];
    const options = orderedKeys.map(
      (key) => [key, question.criteria[key]] as const,
    );
    return (
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-ink/60">
            {t("criteria")} · {t("options")} · {options.length}/
            {definitionLimits.choiceOptions}
          </p>
          <Button
            aria-label={`${question.label} ${t("addOption")}`}
            disabled={options.length >= definitionLimits.choiceOptions}
            onClick={() => {
              let suffix = 0;
              while (
                Object.hasOwn(
                  question.criteria,
                  `option${String.fromCharCode(65 + suffix)}`,
                )
              )
                suffix += 1;
              const id = `option${String.fromCharCode(65 + suffix)}`;
              onChange({
                ...question,
                criteria: {
                  ...question.criteria,
                  [id]: t("newOptionCriteria"),
                },
              });
            }}
            className="border border-ink/10"
          >
            <Plus size={14} className="mr-2" /> {t("addOption")}
          </Button>
        </div>
        <p className="text-xs leading-5 text-ink/50">
          {t("choiceCriteriaHelp")}
        </p>
        {optionError && (
          <p role="alert" className="text-xs text-coral">
            {optionError}
          </p>
        )}
        {options.map(([option, criterion], optionIndex) => {
          const reason = protectedOptions.includes(option)
            ? t("optionUsedInPolicy")
            : options.length <= 2
              ? t("minimumOptions")
              : undefined;
          return (
            <div key={optionIndex} className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-question">
                <label className="min-w-0 text-xs text-ink/60">
                  <span className="mb-2 block font-bold">
                    {t("returnedValue")}
                  </span>
                  <input
                    aria-label={`${question.label} ${t("optionValue")} ${optionIndex + 1}`}
                    value={option}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (
                        next !== option &&
                        Object.hasOwn(question.criteria, next)
                      ) {
                        setOptionError(t("duplicateOptionValue"));
                        return;
                      }
                      setOptionError(null);
                      setOptionOrder(
                        orderedKeys.map((key) => (key === option ? next : key)),
                      );
                      onRenameOption(option, next);
                    }}
                    className="w-full min-w-0 rounded-lg border border-ink/10 bg-paper p-2 font-mono text-xs"
                  />
                </label>
                <label className="min-w-0 text-xs text-ink/60">
                  <span className="mb-2 block font-bold">
                    {t("criterionOptional")}
                  </span>
                  <input
                    aria-label={`${question.label} ${option} ${t("criteria")}`}
                    value={criterion ?? ""}
                    placeholder={t("optionDescriptionPlaceholder")}
                    onChange={(event) =>
                      onChange({
                        ...question,
                        criteria: {
                          ...question.criteria,
                          [option]: event.target.value.trim()
                            ? event.target.value
                            : null,
                        },
                      })
                    }
                    className="w-full min-w-0 rounded-lg border border-ink/10 p-2 text-sm text-ink"
                  />
                </label>
              </div>
              <Button
                size="icon"
                aria-label={`${question.label} ${t("deleteOption")} ${option}`}
                title={reason}
                disabled={Boolean(reason)}
                onClick={() =>
                  onChange({
                    ...question,
                    criteria: Object.fromEntries(
                      options.filter(([id]) => id !== option),
                    ),
                  })
                }
                className="shrink-0 self-end text-ink/50 hover:text-coral"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          );
        })}
        <p className="text-xs text-ink/50">{t("minimumOptions")}</p>
      </div>
    );
  }

  function moveLevel(index: number, offset: number) {
    if (question.kind !== "score") return;
    const levels = [...question.levels];
    const target = index + offset;
    if (target < 0 || target >= levels.length) return;
    [levels[index], levels[target]] = [levels[target], levels[index]];
    onChange({ ...question, levels });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-ink/60">
            {t("criteria")} · {t("levels")} · {question.levels.length}/
            {definitionLimits.scoreLevels}
          </p>
          <p className="mt-1 text-xs text-ink/50">{t("scoreCriteriaHelp")}</p>
        </div>
        <Button
          aria-label={`${question.label} ${t("addLevel")}`}
          disabled={question.levels.length >= definitionLimits.scoreLevels}
          onClick={() =>
            onChange({
              ...question,
              levels: [
                ...question.levels,
                {
                  label: `${t("level")} ${question.levels.length + 1}`,
                  description: t("newLevelDescription"),
                },
              ],
            })
          }
          className="border border-ink/10"
        >
          <Plus size={14} className="mr-2" /> {t("addLevel")}
        </Button>
      </div>
      {question.levels.map((level, index) => (
        <div key={index} className="flex flex-wrap items-start gap-2">
          <div className="grid min-w-0 flex-1 basis-48 gap-2 sm:grid-cols-question">
            <label className="min-w-0 text-xs text-ink/60">
              <span className="mb-2 block font-bold">
                {index} · {t("levelLabel")}
              </span>
              <input
                aria-label={`${question.label} ${t("level")} ${index + 1} ${t("title")}`}
                value={level.label}
                onChange={(event) =>
                  onChange({
                    ...question,
                    levels: question.levels.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  })
                }
                className="w-full min-w-0 rounded-lg border border-ink/10 bg-paper p-2 text-sm font-bold"
              />
            </label>
            <label className="min-w-0 text-xs text-ink/60">
              <span className="mb-2 block font-bold">{t("criteria")}</span>
              <input
                aria-label={`${question.label} ${t("level")} ${index + 1} ${t("description")}`}
                value={level.description}
                onChange={(event) =>
                  onChange({
                    ...question,
                    levels: question.levels.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  })
                }
                className="w-full min-w-0 rounded-lg border border-ink/10 p-2 text-sm text-ink"
              />
            </label>
          </div>
          <div className="ml-auto flex shrink-0 self-end items-center">
            <Button
              size="icon"
              aria-label={`${question.label} ${t("moveLevelUp")} ${index + 1}`}
              disabled={index === 0}
              onClick={() => moveLevel(index, -1)}
              className="text-ink/50"
            >
              <ArrowUp size={16} />
            </Button>
            <Button
              size="icon"
              aria-label={`${question.label} ${t("moveLevelDown")} ${index + 1}`}
              disabled={index === question.levels.length - 1}
              onClick={() => moveLevel(index, 1)}
              className="text-ink/50"
            >
              <ArrowDown size={16} />
            </Button>
            <Button
              size="icon"
              aria-label={`${question.label} ${t("deleteLevel")} ${index + 1}`}
              title={
                question.levels.length <= 2 ? t("minimumLevels") : undefined
              }
              disabled={question.levels.length <= 2}
              onClick={() =>
                onChange({
                  ...question,
                  levels: question.levels.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              className="text-ink/50 hover:text-coral"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      ))}
      <p className="text-xs text-ink/50">{t("minimumLevels")}</p>
    </div>
  );
}
