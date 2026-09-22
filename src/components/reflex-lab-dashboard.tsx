"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ChartNetwork, Check, ChevronDown, ChevronRight, Gauge, Layers3, LoaderCircle, PanelLeftClose, PanelLeftOpen, Plus, ShieldAlert, Trash2, Wrench } from "lucide-react";
import { calculateRanking, compareResults, evaluatePolicy, type ExperimentResult, type TypedAnswer } from "@/lib/evaluation";
import { experiments, type ExperimentDefinitionV1, type ExperimentState, type StateField } from "@/lib/experiments";
import { loadPresets, loadPreviousResult, savePreviousResult } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { trpc } from "@/components/trpc-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const accentStyles = {
  coral: "bg-coral/15 text-coral-foreground", sky: "bg-sky/20 text-sky-foreground", lavender: "bg-lavender/25 text-lavender-foreground",
  moss: "bg-moss/20 text-moss-foreground", ink: "bg-ink text-white", gold: "bg-gold text-gold-foreground",
} as const;
const tabs = ["Outcome", "Answers", "Composition", "Compare", "API"] as const;
type ResultTab = typeof tabs[number];

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function percent(value: number) { return `${Math.round(value * 100)}%`; }
function humanize(value: string) { return value.replaceAll("-", " ").replaceAll("_", " "); }

function RecordListEditor({ field, value, onChange }: { field: Extract<StateField, { type: "records" }>; value: unknown; onChange: (value: Array<Record<string, string>>) => void }) {
  const records = Array.isArray(value) ? value as Array<Record<string, string>> : [];
  return <div className="space-y-3">
    {records.map((record, index) => <div key={index} className="rounded-2xl border border-ink/10 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-ink/45">Record {index + 1}</p><button aria-label={`Remove ${field.label} record ${index + 1}`} disabled={records.length <= field.minItems} onClick={() => onChange(records.filter((_, recordIndex) => recordIndex !== index))} className="text-ink/35 hover:text-coral disabled:opacity-20"><Trash2 size={15} /></button></div>
      <div className="grid gap-3 sm:grid-cols-2">{field.columns.map((column) => <label key={column.id} className={column.multiline ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-bold">{column.label}</span>{column.multiline ? <textarea value={String(record[column.id] ?? "")} onChange={(event) => onChange(records.map((item, recordIndex) => recordIndex === index ? { ...item, [column.id]: event.target.value } : item))} className="min-h-20 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40" /> : <input value={String(record[column.id] ?? "")} onChange={(event) => onChange(records.map((item, recordIndex) => recordIndex === index ? { ...item, [column.id]: event.target.value } : item))} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40" />}</label>)}</div>
    </div>)}
    <Button type="button" disabled={records.length >= field.maxItems} onClick={() => onChange([...records, Object.fromEntries(field.columns.map((column) => [column.id, ""]))])} className="border border-ink/10 bg-white"><Plus size={15} className="mr-2" /> Add record</Button>
  </div>;
}

function StateEditor({ definition, state, onChange }: { definition: ExperimentDefinitionV1; state: ExperimentState; onChange: (state: ExperimentState) => void }) {
  return <div className="space-y-5">{definition.fields.map((field) => <label key={field.id} className="block">
    <span className="mb-2 block text-sm font-bold">{field.label}<span className="ml-2 text-xs font-normal text-ink/45">{field.description}</span></span>
    {field.type === "records" ? <RecordListEditor field={field} value={state[field.id]} onChange={(value) => onChange({ ...state, [field.id]: value })} />
      : field.type === "multiline" ? <textarea aria-label={field.label} value={String(state[field.id] ?? "")} onChange={(event) => onChange({ ...state, [field.id]: event.target.value })} className="min-h-28 w-full resize-y rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm leading-6 outline-none transition focus:border-ink/40 focus:bg-white" />
      : field.type === "json" ? <textarea aria-label={field.label} value={JSON.stringify(state[field.id] ?? {}, null, 2)} onChange={(event) => { try { onChange({ ...state, [field.id]: JSON.parse(event.target.value) as unknown }); } catch {} }} className="min-h-28 w-full rounded-2xl border border-ink/10 bg-code px-4 py-3 font-mono text-xs text-white outline-none" />
      : <input aria-label={field.label} value={String(state[field.id] ?? "")} onChange={(event) => onChange({ ...state, [field.id]: event.target.value })} className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink/40 focus:bg-white" />}
  </label>)}</div>;
}

function AnswerSummary({ answer }: { answer: TypedAnswer }) {
  if (answer.kind === "choice") return <><span className="capitalize">{humanize(answer.selected)}</span><span>{percent(answer.confidence)} confidence</span></>;
  if (answer.kind === "score") return <><span>{answer.rawScore.toFixed(2)} / {answer.legend.length - 1}</span><span>{percent(answer.confidence)} confidence</span></>;
  return <><span>{answer.probabilityYes >= 0.5 ? "Yes" : "No"}</span><span>{percent(answer.probabilityYes)} yes</span></>;
}

function AnswerCard({ answer }: { answer: TypedAnswer }) {
  return <details className="group rounded-2xl border border-ink/10 bg-white open:shadow-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4"><div><p className="text-xs font-black uppercase tracking-wider text-ink/40">{answer.kind}{answer.recordLabel ? ` · ${answer.recordLabel}` : ""}</p><p className="mt-1 font-black">{answer.label}</p></div><div className="flex items-center gap-4 text-right text-sm font-bold"><span className="hidden items-center gap-2 text-ink/45 sm:flex"><AnswerSummary answer={answer} /></span><ChevronRight size={17} className="transition group-open:rotate-90" /></div></summary>
    <div className="border-t border-ink/10 p-4"><p className="mb-4 text-sm leading-6 text-ink/55">{answer.instructions}</p>
      {answer.kind === "choice" && <div className="space-y-4">{Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]).map(([option, probability]) => <div key={option}><div className="mb-1 flex justify-between text-xs font-bold"><span className="capitalize">{humanize(option)}</span><span>{percent(probability)}</span></div><Progress value={probability} /><p className="mt-1 text-xs text-ink/45">{answer.criteria[option]}</p></div>)}</div>}
      {answer.kind === "score" && <div className="space-y-3">{answer.legend.map((level) => <div key={level.index} className={cn("rounded-xl border p-3", Math.round(answer.rawScore) === level.index ? "border-ink bg-paper" : "border-ink/5")}><div className="flex items-center justify-between text-xs font-bold"><span>{level.index} · {level.label}</span><span>{percent(answer.probabilities[String(level.index)] ?? 0)}</span></div><p className="mt-1 text-xs text-ink/45">{level.description}</p></div>)}</div>}
      {answer.kind === "noul" && <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-moss/10 p-3"><p className="font-black">Yes · {percent(answer.probabilityYes)}</p><p className="mt-1 text-xs text-ink/55">{answer.criteria.true}</p></div><div className="rounded-xl bg-coral/10 p-3"><p className="font-black">No · {percent(answer.probabilityNo)}</p><p className="mt-1 text-xs text-ink/55">{answer.criteria.false}</p></div></div>}
    </div>
  </details>;
}

export function ReflexLabDashboard() {
  const [catalog, setCatalog] = useState<ExperimentDefinitionV1[]>(experiments);
  const [definition, setDefinition] = useState<ExperimentDefinitionV1>(() => clone(experiments[0]));
  const [state, setState] = useState<ExperimentState>(() => clone(experiments[0].sampleState));
  const [activeTab, setActiveTab] = useState<ResultTab>("Outcome");
  const [labMenuOpen, setLabMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [previous, setPrevious] = useState<ExperimentResult | null>(null);
  const mutation = trpc.evaluation.evaluate.useMutation();
  useEffect(() => setCatalog([...experiments, ...loadPresets().map((preset) => preset.definition)]), []);
  const result = mutation.data as ExperimentResult | undefined;
  const budgetExhausted = mutation.error?.data?.code === "PAYMENT_REQUIRED";
  const policy = useMemo(() => result ? evaluatePolicy(definition, result.answers) : null, [definition, result]);
  const ranking = useMemo(() => result ? calculateRanking(definition, state, result.answers) : [], [definition, result, state]);
  const comparison = useMemo(() => result ? compareResults(result, previous) : [], [result, previous]);

  function selectExperiment(id: string) {
    const next = catalog.find((item) => item.id === id) ?? experiments[0];
    setDefinition(clone(next)); setState(clone(next.sampleState)); setPrevious(null); setActiveTab("Outcome"); setLabMenuOpen(false); mutation.reset();
  }
  function evaluate() {
    mutation.mutate({ definition, state }, { onSuccess(data) { const next = data as ExperimentResult; setPrevious(loadPreviousResult(next.experimentId)); savePreviousResult(next); setActiveTab("Outcome"); } });
  }
  function updateMetricWeight(id: string, weight: number) { setDefinition((current) => ({ ...current, policy: { ...current.policy, metrics: current.policy.metrics.map((metric) => metric.id === id ? { ...metric, weight } : metric) } })); }
  function updateThreshold(ruleId: string, conditionIndex: number, value: number) { setDefinition((current) => ({ ...current, policy: { ...current.policy, rules: current.policy.rules.map((rule) => rule.id === ruleId ? { ...rule, all: rule.all.map((condition, index) => index === conditionIndex && condition.type === "metric" ? { ...condition, value } : condition) } : rule) } })); }

  return <main className="min-h-screen">
    <div className="mx-auto max-w-workbench px-4 py-5 sm:px-8 lg:px-10 xl:px-12">
      <header className="flex items-center justify-between gap-4 border-b border-ink/10 pb-5">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><ChartNetwork size={19} /></div><div><p className="text-lg font-black tracking-tight">Jev Lab</p><p className="text-xs font-semibold uppercase tracking-brand text-ink/50">Decision systems, made inspectable.</p></div></div>
        <div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs font-bold text-ink/50 md:flex"><span className="h-2 w-2 rounded-full bg-moss" /> LOCAL WORKBENCH</div><Link href="/studio" className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-bold text-white"><Wrench size={15} className="mr-2" /> Studio</Link></div>
      </header>
      <section className={cn("grid items-start gap-7 pb-16 pt-8 xl:gap-9", desktopMenuOpen ? "lg:grid-cols-sidebar" : "lg:grid-cols-sidebar-collapsed")}>
        <aside className="min-w-0 lg:sticky lg:top-6">
          <div className="mb-3 hidden items-center justify-between gap-2 lg:flex">
            {desktopMenuOpen && <p className="text-xs font-black uppercase tracking-label text-ink/45">Capability labs</p>}
            <button type="button" aria-label={desktopMenuOpen ? "Collapse capability labs" : "Expand capability labs"} aria-expanded={desktopMenuOpen} onClick={() => setDesktopMenuOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-xl border border-ink/10 bg-white text-ink shadow-card transition hover:bg-paper">
              {desktopMenuOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
            </button>
          </div>
          <button type="button" aria-controls="lab-menu" aria-expanded={labMenuOpen} onClick={() => setLabMenuOpen((open) => !open)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left shadow-card lg:hidden"><span className="min-w-0"><span className="block text-xs font-black uppercase tracking-meta text-ink/45">Capability labs</span><span className="mt-1 block truncate text-sm font-bold">{definition.title}</span></span><ChevronDown size={19} className={cn("shrink-0 transition-transform", labMenuOpen && "rotate-180")} /></button>
          <nav id="lab-menu" className={cn("mt-2 gap-2 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1", labMenuOpen ? "grid" : "hidden", desktopMenuOpen ? "lg:grid" : "lg:hidden")} aria-label="Decision experiments">{catalog.map((item) => <button key={item.id} onClick={() => selectExperiment(item.id)} aria-current={item.id === definition.id ? "page" : undefined} className={cn("group flex min-w-0 w-full items-center justify-between gap-2 rounded-2xl p-3 text-left transition", item.id === definition.id ? "bg-white shadow-card" : "hover:bg-white/60")}><span className="flex min-w-0 items-center gap-3"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black", accentStyles[item.accent])}>{item.eyebrow.slice(0, 2)}</span><span className="min-w-0"><span className="block text-sm font-bold leading-5">{item.title}</span><span className="mt-0.5 block text-xs text-ink/45">{item.eyebrow}</span></span></span><ArrowRight className={cn("shrink-0 opacity-0 transition group-hover:opacity-50", item.id === definition.id && "opacity-100")} size={16} /></button>)}</nav>
          {!desktopMenuOpen && <nav className="hidden flex-col gap-2 lg:flex" aria-label="Compact decision experiments">{catalog.map((item) => <button key={item.id} type="button" onClick={() => selectExperiment(item.id)} title={item.title} aria-label={item.title} aria-current={item.id === definition.id ? "page" : undefined} className={cn("grid h-12 w-12 place-items-center rounded-xl transition", item.id === definition.id ? "bg-white shadow-card ring-1 ring-ink/10" : "hover:bg-white/60")}><span className={cn("grid h-9 w-9 place-items-center rounded-lg text-xs font-black", accentStyles[item.accent])}>{item.eyebrow.slice(0, 2)}</span></button>)}</nav>}
          {desktopMenuOpen && <div className="grain mt-8 hidden rounded-3xl bg-grain p-5 lg:block"><p className="text-xs font-black uppercase tracking-kicker text-ink/50">Typed evidence</p><p className="mt-3 text-sm leading-6 text-ink/75">Every lab exposes calibrated answers, criteria, score legends, and deterministic policy traces.</p></div>}
        </aside>
        <div className="min-w-0"><div className="mb-8"><div className="flex flex-wrap items-center gap-x-5 gap-y-3"><p className="text-xs font-black uppercase tracking-label text-ink/45">{definition.eyebrow}</p><div className={cn("rounded-full px-4 py-2 text-xs font-black uppercase tracking-pill", accentStyles[definition.accent])}><Activity className="mr-2 inline" size={14} /> {definition.questions.length} atomic questions</div></div><h1 className="mt-4 text-4xl font-black tracking-display sm:text-5xl lg:text-5xl lg:leading-display">{definition.title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-ink/60">{definition.description}</p></div>
        <div className={cn("grid min-w-0 items-start gap-7 2xl:gap-8", desktopMenuOpen ? "2xl:grid-cols-equal" : "xl:grid-cols-equal")}>
        <section className="min-w-0">
          <Card className="p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-black">Experiment state</h2><p className="mt-1 text-sm text-ink/50">Edit the evidence sent to Jev.</p></div><Layers3 size={20} className="text-ink/35" /></div><StateEditor definition={definition} state={state} onChange={setState} /><div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5"><p className="text-xs text-ink/45">Provider: <span className="font-bold text-ink/70">OpenRouter · Jev 1.13</span></p><Button onClick={evaluate} disabled={mutation.isPending} className="bg-ink text-white">{mutation.isPending ? <><LoaderCircle className="mr-2 animate-spin" size={16} /> Evaluating</> : <>Evaluate lab <ArrowRight className="ml-2" size={16} /></>}</Button></div></Card>
          {mutation.error && <Alert className="mt-5 border-coral/30 bg-coral/10 text-danger-foreground"><ShieldAlert className="mr-2 inline" size={17} /><span className="font-bold">{budgetExhausted ? "Budget exhausted." : "Evaluation failed."}</span> {mutation.error.message}{mutation.error.data?.code === "PRECONDITION_FAILED" && <p className="mt-2 text-xs opacity-80">For local work without credentials, set <code>MOCK_JEV=true</code> in <code>.env.local</code>.</p>}</Alert>}
        </section>
        <aside className="min-w-0"><Card className="overflow-hidden"><div className="bg-ink px-5 pt-5 text-white sm:px-7"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-kicker text-white/55">Decision evidence</p><h2 className="mt-1 text-2xl font-black">Result workspace</h2></div><Gauge size={25} className="text-white/60" /></div><div className="mt-5 flex gap-1 overflow-x-auto" role="tablist" aria-label="Result views">{tabs.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={cn("whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold", activeTab === tab ? "border-white text-white" : "border-transparent text-white/55 hover:text-white/85")}>{tab}</button>)}</div></div>
          {!result ? <div className="p-5 sm:p-7"><div className="rounded-2xl border border-ink/10 bg-paper p-5 text-sm leading-6 text-ink/60">Run the lab to inspect every typed answer, the composition trace, previous-run deltas, and the exact sanitized API payload.</div></div> : <div className="p-5 sm:p-7">
            {activeTab === "Outcome" && policy && <div className="space-y-5"><div className={cn("rounded-2xl p-5", policy.outcome === "act" ? "bg-moss/15 text-success-foreground" : policy.outcome === "stop" ? "bg-coral/15 text-danger-foreground" : "bg-gold/45 text-review-foreground")}><p className="text-xs font-black uppercase tracking-widest">{policy.outcome === "act" ? <Check className="mr-1 inline" size={15} /> : <ShieldAlert className="mr-1 inline" size={15} />} {policy.outcome}</p><h3 className="mt-2 text-xl font-black">{policy.recommendation}</h3><p className="mt-3 text-sm opacity-75">Composite signal {percent(policy.score)} · {policy.matchedRuleId ? `matched ${humanize(policy.matchedRuleId)}` : "fallback policy"}</p></div>
              {ranking.length > 0 && <div><h3 className="mb-3 text-sm font-black">{definition.ranking?.label}</h3><div className="space-y-2">{ranking.map((row, index) => <div key={row.recordIndex} className="flex items-center gap-3 rounded-xl bg-paper p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-black text-white">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{row.label}</span><span className="text-sm font-black">{percent(row.score)}</span></div>)}</div></div>}
              <div className="grid gap-3 text-xs sm:grid-cols-2"><div className="min-w-0 rounded-xl bg-paper p-3"><p className="text-ink/45">Latency</p><p className="mt-1 font-black">{result.telemetry.latencyMs} ms</p></div><div className="min-w-0 rounded-xl bg-paper p-3"><p className="text-ink/45">Tokens</p><p className="mt-1 font-black">{result.telemetry.usage.totalTokens ?? "—"}</p></div><div className="min-w-0 rounded-xl bg-paper p-3"><p className="text-ink/45">Model</p><p className="mt-1 break-words font-black">{result.telemetry.model}</p></div><div className="min-w-0 rounded-xl bg-paper p-3"><p className="text-ink/45">Cost</p><p className="mt-1 font-black">{result.telemetry.cost === null ? "—" : `$${result.telemetry.cost.toFixed(6)}`}</p></div></div><p className="text-xs leading-5 text-ink/45">{definition.simulatedAction}</p></div>}
            {activeTab === "Answers" && <div className="space-y-3">{result.answers.map((answer) => <AnswerCard key={answer.id} answer={answer} />)}</div>}
            {activeTab === "Composition" && policy && <div className="space-y-6"><div><h3 className="text-sm font-black">Weighted metrics</h3><p className="mt-1 text-xs text-ink/45">These controls recompute locally without another provider request.</p><div className="mt-4 space-y-4">{policy.metrics.map((metric) => <div key={metric.id} className="rounded-xl bg-paper p-3"><div className="flex justify-between text-xs font-bold"><span>{metric.label}</span><span>{percent(metric.effectiveValue)} × {metric.weight.toFixed(1)} = {metric.contribution.toFixed(2)}</span></div><input aria-label={`${metric.label} weight`} type="range" min="0" max="3" step="0.1" value={metric.weight} onChange={(event) => updateMetricWeight(metric.id, Number(event.target.value))} className="mt-3 w-full accent-ink" /></div>)}</div></div>
              <div><h3 className="mb-3 text-sm font-black">Ordered rules</h3><div className="space-y-3">{policy.rules.map((rule) => <div key={rule.id} className={cn("rounded-xl border p-3", rule.passed ? "border-moss/40 bg-moss/10" : "border-ink/10")}><div className="flex justify-between gap-3"><p className="text-sm font-black">{rule.label}</p><span className="text-xs font-black uppercase">{rule.passed ? "passed" : "failed"}</span></div>{rule.conditions.map((condition, index) => <div key={index} className="mt-3 rounded-lg bg-white/70 p-2 text-xs"><div className="flex items-center justify-between gap-2"><span>{condition.description}</span><span className={condition.passed ? "text-moss" : "text-coral"}>{condition.passed ? "true" : "false"}</span></div>{definition.policy.rules.find((item) => item.id === rule.id)?.all[index]?.type === "metric" && <input aria-label={`${rule.label} condition ${index + 1}`} type="range" min="0" max="1" step="0.05" value={Number(condition.expected)} onChange={(event) => updateThreshold(rule.id, index, Number(event.target.value))} className="mt-2 w-full accent-ink" />}</div>)}</div>)}</div></div></div>}
            {activeTab === "Compare" && <div>{comparison.length === 0 ? <p className="rounded-xl bg-paper p-4 text-sm text-ink/55">Run this lab again in the current browser session to compare answer and probability deltas.</p> : <div className="space-y-2">{comparison.map((delta) => <div key={delta.id} className="rounded-xl border border-ink/10 p-3"><div className="flex justify-between gap-3"><p className="text-sm font-bold">{delta.label}</p><span className={cn("text-xs font-black", (delta.delta ?? 0) > 0 ? "text-moss" : (delta.delta ?? 0) < 0 ? "text-coral" : "text-ink/40")}>{delta.delta === null ? "new" : `${delta.delta >= 0 ? "+" : ""}${Math.round(delta.delta * 100)} pts`}</span></div><p className="mt-1 text-xs text-ink/45">{String(delta.previous ?? "—")} → {String(delta.current)}</p></div>)}</div>}</div>}
            {activeTab === "API" && <div className="space-y-4"><div><h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink/45">Sanitized request</h3><pre className="max-h-80 overflow-auto rounded-xl bg-code p-4 text-xs leading-5 text-white">{JSON.stringify(result.request, null, 2)}</pre></div><div><h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink/45">Raw provider response</h3><pre className="max-h-80 overflow-auto rounded-xl bg-code p-4 text-xs leading-5 text-white">{JSON.stringify(result.rawResponse, null, 2)}</pre></div></div>}
          </div>}
        </Card></aside>
        </div>
        </div>
      </section>
    </div>
  </main>;
}
