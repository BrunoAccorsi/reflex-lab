"use client";

import { Check, ChevronRight, Gauge, ShieldAlert } from "lucide-react";
import {
  type AnswerDelta,
  type ExperimentResult,
  type PolicyResult,
  type RankingRow,
  type TypedAnswer,
} from "@/lib/evaluation";
import { type ExperimentDefinitionV1 } from "@/lib/experiments";
import {
  localizedKind,
  localizedOutcome,
  localizeValue,
  type Language,
  type getCopy,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-toggle";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const tabs = ["Outcome", "Answers", "Composition", "Compare", "API"] as const;
export type ResultTab = (typeof tabs)[number];
const tabLabelKeys = {
  Outcome: "outcome",
  Answers: "answers",
  Composition: "composition",
  Compare: "compare",
  API: "api",
} as const;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
function humanize(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ");
}

type AnswerProps = {
  answer: TypedAnswer;
  language: Language;
  t: ReturnType<typeof getCopy>;
};

function AnswerSummary({ answer, language, t }: AnswerProps) {
  if (answer.kind === "choice")
    return (
      <>
        <span>{humanize(localizeValue(answer.selected, language))}</span>
        <span>
          {percent(answer.confidence)} {t("confidence")}
        </span>
      </>
    );
  if (answer.kind === "score")
    return (
      <>
        <span>
          {answer.rawScore.toFixed(2)} / {answer.legend.length - 1}
        </span>
        <span>
          {percent(answer.confidence)} {t("confidence")}
        </span>
      </>
    );
  return (
    <>
      <span>{answer.probabilityYes >= 0.5 ? t("yes") : t("no")}</span>
      <span>
        {percent(answer.probabilityYes)} {t("yesShort")}
      </span>
    </>
  );
}

function AnswerCard({ answer, language, t }: AnswerProps) {
  return (
    <details className="group rounded-2xl border border-ink/10 bg-white open:shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-ink/40">
            {localizedKind(answer.kind, language)}
            {answer.recordLabel ? ` · ${answer.recordLabel}` : ""}
          </p>
          <p className="mt-1 font-black">{answer.label}</p>
        </div>
        <div className="flex items-center gap-4 text-right text-sm font-bold">
          <span className="hidden items-center gap-2 text-ink/45 sm:flex">
            <AnswerSummary answer={answer} language={language} t={t} />
          </span>
          <ChevronRight size={17} className="transition group-open:rotate-90" />
        </div>
      </summary>
      <div className="border-t border-ink/10 p-4">
        <p className="mb-4 text-sm leading-6 text-ink/55">
          {answer.instructions}
        </p>
        {answer.kind === "choice" && (
          <div className="space-y-4">
            {Object.entries(answer.probabilities)
              .sort((a, b) => b[1] - a[1])
              .map(([option, probability]) => (
                <div key={option}>
                  <div className="mb-1 flex justify-between text-xs font-bold">
                    <span>{humanize(localizeValue(option, language))}</span>
                    <span>{percent(probability)}</span>
                  </div>
                  <Progress value={probability} />
                  <p className="mt-1 text-xs text-ink/45">
                    {answer.criteria[option]}
                  </p>
                </div>
              ))}
          </div>
        )}
        {answer.kind === "score" && (
          <div className="space-y-3">
            {answer.legend.map((level) => (
              <div
                key={level.index}
                className={cn(
                  "rounded-xl border p-3",
                  Math.round(answer.rawScore) === level.index
                    ? "border-ink bg-paper"
                    : "border-ink/5",
                )}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>
                    {level.index} · {level.label}
                  </span>
                  <span>
                    {percent(answer.probabilities[String(level.index)] ?? 0)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/45">{level.description}</p>
              </div>
            ))}
          </div>
        )}
        {answer.kind === "noul" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-moss/10 p-3">
              <p className="font-black">
                {t("yes")} · {percent(answer.probabilityYes)}
              </p>
              <p className="mt-1 text-xs text-ink/55">{answer.criteria.true}</p>
            </div>
            <div className="rounded-xl bg-coral/10 p-3">
              <p className="font-black">
                {t("no")} · {percent(answer.probabilityNo)}
              </p>
              <p className="mt-1 text-xs text-ink/55">
                {answer.criteria.false}
              </p>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

type ResultWorkspaceProps = {
  definition: ExperimentDefinitionV1;
  result?: ExperimentResult;
  policy: PolicyResult | null;
  ranking: RankingRow[];
  comparison: AnswerDelta[];
  activeTab: ResultTab;
  onTabChange: (tab: ResultTab) => void;
  onMetricWeightChange: (id: string, weight: number) => void;
  onThresholdChange: (
    ruleId: string,
    conditionIndex: number,
    value: number,
  ) => void;
};

export function ResultWorkspace({
  definition,
  result,
  policy,
  ranking,
  comparison,
  activeTab,
  onTabChange,
  onMetricWeightChange,
  onThresholdChange,
}: ResultWorkspaceProps) {
  const { language, t } = useLanguage();

  return (
    <aside className="min-w-0">
      <Card className="overflow-hidden">
        <div className="bg-ink px-5 pt-5 text-white sm:px-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-kicker text-white/55">
                {t("decisionEvidence")}
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {t("resultWorkspace")}
              </h2>
            </div>
            <Gauge size={25} className="text-white/60" />
          </div>
          <div
            className="mt-5 flex gap-1 overflow-x-auto"
            role="tablist"
            aria-label={t("resultViews")}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => onTabChange(tab)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold",
                  activeTab === tab
                    ? "border-white text-white"
                    : "border-transparent text-white/55 hover:text-white/85",
                )}
              >
                {t(tabLabelKeys[tab])}
              </button>
            ))}
          </div>
        </div>
        {!result ? (
          <div className="p-5 sm:p-7">
            <div className="rounded-2xl border border-ink/10 bg-paper p-5 text-sm leading-6 text-ink/60">
              {t("runLab")}
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-7">
            {activeTab === "Outcome" && policy && (
              <div className="space-y-5">
                <div
                  className={cn(
                    "rounded-2xl p-5",
                    policy.outcome === "act"
                      ? "bg-moss/15 text-success-foreground"
                      : policy.outcome === "stop"
                        ? "bg-coral/15 text-danger-foreground"
                        : "bg-gold/45 text-review-foreground",
                  )}
                >
                  <p className="text-xs font-black uppercase tracking-widest">
                    {policy.outcome === "act" ? (
                      <Check className="mr-1 inline" size={15} />
                    ) : (
                      <ShieldAlert className="mr-1 inline" size={15} />
                    )}{" "}
                    {localizedOutcome(policy.outcome, language)}
                  </p>
                  <h3 className="mt-2 text-xl font-black">
                    {policy.recommendation}
                  </h3>
                  <p className="mt-3 text-sm opacity-75">
                    {t("compositeSignal")} {percent(policy.score)} ·{" "}
                    {policy.matchedRuleId
                      ? `${t("matched")} ${humanize(policy.matchedRuleId)}`
                      : t("fallbackPolicy")}
                  </p>
                </div>
                {ranking.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-black">
                      {definition.ranking?.label}
                    </h3>
                    <div className="space-y-2">
                      {ranking.map((row, index) => (
                        <div
                          key={row.recordIndex}
                          className="flex items-center gap-3 rounded-xl bg-paper p-3"
                        >
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-black text-white">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">
                            {row.label}
                          </span>
                          <span className="text-sm font-black">
                            {percent(row.score)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-paper p-3">
                    <p className="text-ink/45">{t("latency")}</p>
                    <p className="mt-1 font-black">
                      {result.telemetry.latencyMs} ms
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-paper p-3">
                    <p className="text-ink/45">{t("tokens")}</p>
                    <p className="mt-1 font-black">
                      {result.telemetry.usage.totalTokens ?? "—"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-paper p-3">
                    <p className="text-ink/45">{t("model")}</p>
                    <p className="mt-1 break-words font-black">
                      {result.telemetry.model}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-paper p-3">
                    <p className="text-ink/45">{t("cost")}</p>
                    <p className="mt-1 font-black">
                      {result.telemetry.cost === null
                        ? "—"
                        : `$${result.telemetry.cost.toFixed(6)}`}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-ink/45">
                  {definition.simulatedAction}
                </p>
              </div>
            )}
            {activeTab === "Answers" && (
              <div className="space-y-3">
                {result.answers.map((answer) => (
                  <AnswerCard
                    key={answer.id}
                    answer={answer}
                    language={language}
                    t={t}
                  />
                ))}
              </div>
            )}
            {activeTab === "Composition" && policy && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black">{t("weightedMetrics")}</h3>
                  <p className="mt-1 text-xs text-ink/45">{t("recompute")}</p>
                  <div className="mt-4 space-y-4">
                    {policy.metrics.map((metric) => (
                      <div key={metric.id} className="rounded-xl bg-paper p-3">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{metric.label}</span>
                          <span>
                            {percent(metric.effectiveValue)} ×{" "}
                            {metric.weight.toFixed(1)} ={" "}
                            {metric.contribution.toFixed(2)}
                          </span>
                        </div>
                        <input
                          aria-label={`${metric.label} weight`}
                          type="range"
                          min="0"
                          max="3"
                          step="0.1"
                          value={metric.weight}
                          onChange={(event) =>
                            onMetricWeightChange(
                              metric.id,
                              Number(event.target.value),
                            )
                          }
                          className="mt-3 w-full accent-ink"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-black">
                    {t("orderedRules")}
                  </h3>
                  <div className="space-y-3">
                    {policy.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={cn(
                          "rounded-xl border p-3",
                          rule.passed
                            ? "border-moss/40 bg-moss/10"
                            : "border-ink/10",
                        )}
                      >
                        <div className="flex justify-between gap-3">
                          <p className="text-sm font-black">{rule.label}</p>
                          <span className="text-xs font-black uppercase">
                            {rule.passed ? t("passed") : t("failed")}
                          </span>
                        </div>
                        {rule.conditions.map((condition, index) => (
                          <div
                            key={index}
                            className="mt-3 rounded-lg bg-white/70 p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{condition.description}</span>
                              <span
                                className={
                                  condition.passed ? "text-moss" : "text-coral"
                                }
                              >
                                {condition.passed ? t("true") : t("false")}
                              </span>
                            </div>
                            {definition.policy.rules.find(
                              (item) => item.id === rule.id,
                            )?.all[index]?.type === "metric" && (
                              <input
                                aria-label={`${rule.label} ${t("condition")} ${index + 1}`}
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={Number(condition.expected)}
                                onChange={(event) =>
                                  onThresholdChange(
                                    rule.id,
                                    index,
                                    Number(event.target.value),
                                  )
                                }
                                className="mt-2 w-full accent-ink"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "Compare" && (
              <div>
                {comparison.length === 0 ? (
                  <p className="rounded-xl bg-paper p-4 text-sm text-ink/55">
                    {t("compareEmpty")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {comparison.map((delta) => (
                      <div
                        key={delta.id}
                        className="rounded-xl border border-ink/10 p-3"
                      >
                        <div className="flex justify-between gap-3">
                          <p className="text-sm font-bold">{delta.label}</p>
                          <span
                            className={cn(
                              "text-xs font-black",
                              (delta.delta ?? 0) > 0
                                ? "text-moss"
                                : (delta.delta ?? 0) < 0
                                  ? "text-coral"
                                  : "text-ink/40",
                            )}
                          >
                            {delta.delta === null
                              ? t("newValue")
                              : `${delta.delta >= 0 ? "+" : ""}${Math.round(delta.delta * 100)} pts`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink/45">
                          {String(delta.previous ?? "—")} →{" "}
                          {String(delta.current)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "API" && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink/45">
                    {t("sanitizedRequest")}
                  </h3>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-code p-4 text-xs leading-5 text-white">
                    {JSON.stringify(result.request, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink/45">
                    {t("rawResponse")}
                  </h3>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-code p-4 text-xs leading-5 text-white">
                    {JSON.stringify(result.rawResponse, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </aside>
  );
}
