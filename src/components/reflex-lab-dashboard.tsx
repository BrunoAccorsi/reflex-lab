"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ChartNetwork,
  Layers3,
  LoaderCircle,
  Plus,
  ShieldAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  calculateRanking,
  compareResults,
  evaluatePolicy,
  type ExperimentResult,
} from "@/lib/evaluation";
import {
  experiments,
  type ExperimentDefinitionV1,
  type ExperimentState,
  type StateField,
} from "@/lib/experiments";
import { localizeDefinition, localizedExperiments } from "@/lib/i18n";
import {
  loadPresets,
  loadPreviousResult,
  savePreviousResult,
} from "@/lib/presets";
import { cn } from "@/lib/utils";
import { accentStyles } from "@/lib/experiment-theme";
import { trpc } from "@/components/trpc-provider";
import { LanguageToggle, useLanguage } from "@/components/language-toggle";
import { LabSelector } from "@/components/lab-selector";
import { ResultWorkspace, type ResultTab } from "@/components/result-workspace";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function RecordListEditor({
  field,
  value,
  onChange,
}: {
  field: Extract<StateField, { type: "records" }>;
  value: unknown;
  onChange: (value: Array<Record<string, string>>) => void;
}) {
  const { t } = useLanguage();
  const records = Array.isArray(value)
    ? (value as Array<Record<string, string>>)
    : [];
  function updateRecord(index: number, columnId: string, value: string) {
    onChange(
      records.map((record, recordIndex) =>
        recordIndex === index ? { ...record, [columnId]: value } : record,
      ),
    );
  }
  return (
    <div className="space-y-3">
      {records.map((record, index) => (
        <div
          key={index}
          className="rounded-2xl border border-ink/10 bg-paper p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-ink/45">
              {t("record")} {index + 1}
            </p>
            <button
              aria-label={`${t("remove")} ${field.label} ${t("record")} ${index + 1}`}
              disabled={records.length <= field.minItems}
              onClick={() =>
                onChange(
                  records.filter((_, recordIndex) => recordIndex !== index),
                )
              }
              className="text-ink/35 hover:text-coral disabled:opacity-20"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field.columns.map((column) => (
              <label
                key={column.id}
                className={column.multiline ? "sm:col-span-2" : ""}
              >
                <span className="mb-1 block text-xs font-bold">
                  {column.label}
                </span>
                {column.multiline ? (
                  <textarea
                    value={String(record[column.id] ?? "")}
                    onChange={(event) =>
                      updateRecord(index, column.id, event.target.value)
                    }
                    className="min-h-20 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
                  />
                ) : (
                  <input
                    value={String(record[column.id] ?? "")}
                    onChange={(event) =>
                      updateRecord(index, column.id, event.target.value)
                    }
                    className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button
        type="button"
        disabled={records.length >= field.maxItems}
        onClick={() =>
          onChange([
            ...records,
            Object.fromEntries(field.columns.map((column) => [column.id, ""])),
          ])
        }
        className="border border-ink/10 bg-white"
      >
        <Plus size={15} className="mr-2" /> {t("addRecord")}
      </Button>
    </div>
  );
}

function StateEditor({
  definition,
  state,
  onChange,
}: {
  definition: ExperimentDefinitionV1;
  state: ExperimentState;
  onChange: (state: ExperimentState) => void;
}) {
  return (
    <div className="space-y-5">
      {definition.fields.map((field) => (
        <label key={field.id} className="block">
          <span className="mb-2 block text-sm font-bold">
            {field.label}
            <span className="ml-2 text-xs font-normal text-ink/45">
              {field.description}
            </span>
          </span>
          {field.type === "records" ? (
            <RecordListEditor
              field={field}
              value={state[field.id]}
              onChange={(value) => onChange({ ...state, [field.id]: value })}
            />
          ) : field.type === "multiline" ? (
            <textarea
              aria-label={field.label}
              value={String(state[field.id] ?? "")}
              onChange={(event) =>
                onChange({ ...state, [field.id]: event.target.value })
              }
              className="min-h-28 w-full resize-y rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm leading-6 outline-none transition focus:border-ink/40 focus:bg-white"
            />
          ) : field.type === "json" ? (
            <textarea
              aria-label={field.label}
              value={JSON.stringify(state[field.id] ?? {}, null, 2)}
              onChange={(event) => {
                try {
                  onChange({
                    ...state,
                    [field.id]: JSON.parse(event.target.value) as unknown,
                  });
                } catch {}
              }}
              className="min-h-28 w-full rounded-2xl border border-ink/10 bg-code px-4 py-3 font-mono text-xs text-white outline-none"
            />
          ) : (
            <input
              aria-label={field.label}
              value={String(state[field.id] ?? "")}
              onChange={(event) =>
                onChange({ ...state, [field.id]: event.target.value })
              }
              className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink/40 focus:bg-white"
            />
          )}
        </label>
      ))}
    </div>
  );
}

export function ReflexLabDashboard() {
  const { language, t } = useLanguage();
  const [catalog, setCatalog] = useState<ExperimentDefinitionV1[]>(experiments);
  const [definition, setDefinition] = useState<ExperimentDefinitionV1>(() =>
    clone(experiments[0]),
  );
  const [state, setState] = useState<ExperimentState>(() =>
    clone(experiments[0].sampleState),
  );
  const [activeTab, setActiveTab] = useState<ResultTab>("Outcome");
  const [labMenuOpen, setLabMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [previous, setPrevious] = useState<ExperimentResult | null>(null);
  const mutation = trpc.evaluation.evaluate.useMutation();
  useEffect(() => {
    setCatalog([
      ...localizedExperiments(language),
      ...loadPresets().map((preset) => preset.definition),
    ]);
    setDefinition((current) => {
      const builtin = experiments.find((item) => item.id === current.id);
      return builtin ? clone(localizeDefinition(builtin, language)) : current;
    });
  }, [language]);
  const result = mutation.data as ExperimentResult | undefined;
  const budgetExhausted = mutation.error?.data?.code === "PAYMENT_REQUIRED";
  const policy = useMemo(
    () => (result ? evaluatePolicy(definition, result.answers) : null),
    [definition, result],
  );
  const ranking = useMemo(
    () => (result ? calculateRanking(definition, state, result.answers) : []),
    [definition, result, state],
  );
  const comparison = useMemo(
    () => (result ? compareResults(result, previous) : []),
    [result, previous],
  );

  function selectExperiment(id: string) {
    const next = catalog.find((item) => item.id === id) ?? experiments[0];
    setDefinition(clone(next));
    setState(clone(next.sampleState));
    setPrevious(null);
    setActiveTab("Outcome");
    setLabMenuOpen(false);
    mutation.reset();
  }
  function evaluate() {
    mutation.mutate(
      { definition, state },
      {
        onSuccess(data) {
          const next = data as ExperimentResult;
          setPrevious(loadPreviousResult(next.experimentId));
          savePreviousResult(next);
          setActiveTab("Outcome");
        },
      },
    );
  }
  function updateMetricWeight(id: string, weight: number) {
    setDefinition((current) => ({
      ...current,
      policy: {
        ...current.policy,
        metrics: current.policy.metrics.map((metric) =>
          metric.id === id ? { ...metric, weight } : metric,
        ),
      },
    }));
  }
  function updateThreshold(
    ruleId: string,
    conditionIndex: number,
    value: number,
  ) {
    setDefinition((current) => ({
      ...current,
      policy: {
        ...current.policy,
        rules: current.policy.rules.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                all: rule.all.map((condition, index) =>
                  index === conditionIndex && condition.type === "metric"
                    ? { ...condition, value }
                    : condition,
                ),
              }
            : rule,
        ),
      },
    }));
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-workbench px-4 py-5 sm:px-8 lg:px-10 xl:px-12">
        <header className="flex items-center justify-between gap-4 border-b border-ink/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">
              <ChartNetwork size={19} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">Jev Lab</p>
              <p className="text-xs font-semibold uppercase tracking-brand text-ink/50">
                Decision systems, made inspectable.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <div className="hidden items-center gap-2 text-xs font-bold text-ink/50 md:flex">
              <span className="h-2 w-2 rounded-full bg-moss" />{" "}
              {t("localWorkbench")}
            </div>
            <Link
              href="/studio"
              className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-bold text-white"
            >
              <Wrench size={15} className="mr-2" /> {t("studio")}
            </Link>
          </div>
        </header>
        <section
          className={cn(
            "grid items-start gap-7 pb-16 pt-8 transition-workbench-grid duration-500 ease-smooth motion-reduce:transition-none xl:gap-9",
            desktopMenuOpen
              ? "lg:grid-cols-sidebar"
              : "lg:grid-cols-sidebar-collapsed",
          )}
        >
          <LabSelector
            catalog={catalog}
            selected={definition}
            desktopMenuOpen={desktopMenuOpen}
            mobileMenuOpen={labMenuOpen}
            onDesktopMenuToggle={() => setDesktopMenuOpen((open) => !open)}
            onMobileMenuToggle={() => setLabMenuOpen((open) => !open)}
            onSelect={selectExperiment}
          />
          <div className="min-w-0">
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <p className="text-xs font-black uppercase tracking-label text-ink/45">
                  {definition.eyebrow}
                </p>
                <div
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-black uppercase tracking-pill",
                    accentStyles[definition.accent],
                  )}
                >
                  <Activity className="mr-2 inline" size={14} />{" "}
                  {definition.questions.length} {t("questionCount")}
                </div>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-display sm:text-5xl lg:text-5xl lg:leading-display">
                {definition.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-ink/60">
                {definition.description}
              </p>
            </div>
            <div
              className={cn(
                "grid min-w-0 items-start gap-7 2xl:gap-8",
                desktopMenuOpen ? "2xl:grid-cols-equal" : "xl:grid-cols-equal",
              )}
            >
              <section className="min-w-0">
                <Card className="p-5 sm:p-7">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black">
                        {t("experimentState")}
                      </h2>
                      <p className="mt-1 text-sm text-ink/50">
                        {t("editEvidence")}
                      </p>
                    </div>
                    <Layers3 size={20} className="text-ink/35" />
                  </div>
                  <StateEditor
                    definition={definition}
                    state={state}
                    onChange={setState}
                  />
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5">
                    <p className="text-xs text-ink/45">
                      {t("provider")}:{" "}
                      <span className="font-bold text-ink/70">
                        OpenRouter · Jev 1.13
                      </span>
                    </p>
                    <Button
                      onClick={evaluate}
                      disabled={mutation.isPending}
                      className="bg-ink text-white"
                    >
                      {mutation.isPending ? (
                        <>
                          <LoaderCircle
                            className="mr-2 animate-spin"
                            size={16}
                          />{" "}
                          {t("evaluating")}
                        </>
                      ) : (
                        <>
                          {t("evaluate")}{" "}
                          <ArrowRight className="ml-2" size={16} />
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
                {mutation.error && (
                  <Alert className="mt-5 border-coral/30 bg-coral/10 text-danger-foreground">
                    <ShieldAlert className="mr-2 inline" size={17} />
                    <span className="font-bold">
                      {budgetExhausted
                        ? t("budgetExhausted")
                        : t("evaluationFailed")}
                    </span>{" "}
                    {mutation.error.message}
                    {mutation.error.data?.code === "PRECONDITION_FAILED" && (
                      <p className="mt-2 text-xs opacity-80">
                        {t("mockHint")} <code>MOCK_JEV=true</code>{" "}
                        {language === "pt-BR" ? "em" : "in"}{" "}
                        <code>.env.local</code>.
                      </p>
                    )}
                  </Alert>
                )}
              </section>
              <ResultWorkspace
                definition={definition}
                result={result}
                policy={policy}
                ranking={ranking}
                comparison={comparison}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onMetricWeightChange={updateMetricWeight}
                onThresholdChange={updateThreshold}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
