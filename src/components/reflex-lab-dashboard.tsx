"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowRight, Check, Gauge, Layers3, LoaderCircle, ShieldAlert, Sparkles } from "lucide-react";
import { applyConfidenceGate } from "@/lib/evaluation";
import { scenarios, type ScenarioId } from "@/lib/scenarios";
import { cn } from "@/lib/utils";
import { trpc } from "@/components/trpc-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type LocalResult = Awaited<ReturnType<typeof trpc.evaluation.evaluate.useMutation>>["data"];

const accentStyles = {
  coral: "bg-coral/15 text-[#a54834]",
  sky: "bg-sky/20 text-[#356b7d]",
  lavender: "bg-lavender/25 text-[#63547d]",
  moss: "bg-moss/20 text-[#46613e]",
  ink: "bg-ink text-white",
} as const;

export function ReflexLabDashboard() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("support-triage");
  const [threshold, setThreshold] = useState(0.8);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const [fields, setFields] = useState<Record<string, string>>(scenario.sample);
  const mutation = trpc.evaluation.evaluate.useMutation();
  const result = mutation.data as LocalResult;

  const gatePreview = useMemo(() => result ? applyConfidenceGate(result, threshold) : null, [result, threshold]);

  function selectScenario(nextId: ScenarioId) {
    const next = scenarios.find((item) => item.id === nextId) ?? scenarios[0];
    setScenarioId(next.id);
    setFields(next.sample);
    mutation.reset();
  }

  function evaluate() {
    mutation.mutate({ scenarioId, fields });
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4 border-b border-ink/10 pb-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><Sparkles size={19} /></div><div><p className="text-lg font-black tracking-tight">Reflex Lab</p><p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/50">Fast decisions. Clear confidence.</p></div></div>
          <div className="hidden items-center gap-2 text-xs font-bold text-ink/50 sm:flex"><span className="h-2 w-2 rounded-full bg-moss" /> LOCAL WORKBENCH <span className="rounded-full border border-ink/10 px-3 py-1">STATELESS</span></div>
        </header>

        <section className="grid gap-8 pb-16 pt-10 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
          <aside>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-ink/45">Experiments</p>
            <nav className="space-y-2" aria-label="Decision experiments">
              {scenarios.map((item) => <button key={item.id} onClick={() => selectScenario(item.id)} className={cn("group flex w-full items-center justify-between rounded-2xl p-3 text-left transition", item.id === scenario.id ? "bg-white shadow-card" : "hover:bg-white/60")}><span className="flex items-center gap-3"><span className={cn("grid h-9 w-9 place-items-center rounded-xl text-xs font-black", accentStyles[item.accent])}>{item.eyebrow.slice(0, 2)}</span><span><span className="block text-sm font-bold">{item.title}</span><span className="mt-0.5 block text-xs text-ink/45">{item.eyebrow}</span></span></span><ArrowRight className={cn("opacity-0 transition group-hover:opacity-50", item.id === scenario.id && "opacity-100")} size={16} /></button>)}
            </nav>
            <div className="grain mt-8 rounded-3xl bg-[#e8e8df] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-ink/50">One engine</p><p className="mt-3 text-sm leading-6 text-ink/75">Every experiment uses the same choice, score, boolean, confidence, and action pipeline.</p></div>
          </aside>

          <section className="min-w-0">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-ink/45">{scenario.eyebrow}</p><h1 className="max-w-2xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">{scenario.title}</h1><p className="mt-3 max-w-xl text-base leading-7 text-ink/60">{scenario.description}</p></div><div className={cn("rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em]", accentStyles[scenario.accent])}><Activity className="mr-2 inline" size={14} /> Ready to evaluate</div></div>
            <Card className="p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-black">Sample input</h2><p className="mt-1 text-sm text-ink/50">Edit the state before asking Jev for a decision.</p></div><Layers3 size={20} className="text-ink/35" /></div><div className="space-y-5">{scenario.fields.map((field) => <label key={field.id} className="block"><span className="mb-2 block text-sm font-bold">{field.label}<span className="ml-2 text-xs font-normal text-ink/45">{field.description}</span></span>{field.multiline === true ? <textarea aria-label={field.label} value={fields[field.id] ?? ""} onChange={(event) => setFields((current) => ({ ...current, [field.id]: event.target.value }))} className="min-h-28 w-full resize-y rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm leading-6 outline-none transition focus:border-ink/40 focus:bg-white" /> : <input aria-label={field.label} value={fields[field.id] ?? ""} onChange={(event) => setFields((current) => ({ ...current, [field.id]: event.target.value }))} className="w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink/40 focus:bg-white" />}</label>)}</div><div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5"><p className="text-xs text-ink/45">Provider: <span className="font-bold text-ink/70">OpenRouter · Jev 1.13</span></p><Button onClick={evaluate} disabled={mutation.isPending} className="bg-ink text-white">{mutation.isPending ? <><LoaderCircle className="mr-2 animate-spin" size={16} /> Evaluating</> : <>Evaluate scenario <ArrowRight className="ml-2" size={16} /></>}</Button></div></Card>
            {mutation.error && <Alert className="mt-5 border-coral/30 bg-coral/10 text-[#8f3c2b]"><ShieldAlert className="mr-2 inline" size={17} /><span className="font-bold">Evaluation failed.</span> {mutation.error.message}<p className="mt-2 text-xs opacity-80">For local work without credentials, set <code>MOCK_JEV=true</code> in <code>.env.local</code>.</p></Alert>}
          </section>

          <aside className="space-y-5">
            <Card className="overflow-hidden"><div className="bg-ink p-6 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Shared result</p><h2 className="mt-2 text-2xl font-black">Decision panel</h2></div><Gauge size={25} className="text-white/60" /></div>{result ? <div className="mt-8"><p className="text-sm text-white/55">Winning answer</p><p className="mt-1 text-3xl font-black capitalize">{result.choice.replaceAll("-", " ")}</p><div className="mt-5 flex items-center gap-3"><Progress value={result.confidence} className="flex-1 bg-white/20" /><span className="text-sm font-black">{Math.round(result.confidence * 100)}%</span></div></div> : <div className="mt-8 rounded-2xl border border-white/15 p-4 text-sm leading-6 text-white/65">Run an experiment to see the selected answer, calibrated probabilities, and automation gate.</div>}</div>{result && <div className="space-y-5 p-6"><div>{Object.entries(result.probabilities).map(([option, probability]) => <div key={option} className="mb-3"><div className="mb-1 flex justify-between text-xs font-bold"><span className="capitalize">{option.replaceAll("-", " ")}</span><span>{Math.round(probability * 100)}%</span></div><Progress value={probability} /></div>)}</div><div className={cn("rounded-2xl p-4 text-sm leading-6", gatePreview?.gatePassed ? "bg-moss/15 text-[#46613e]" : "bg-coral/10 text-[#8f3c2b]")}><p className="font-black">{gatePreview?.gatePassed ? <Check className="mr-1 inline" size={16} /> : <ShieldAlert className="mr-1 inline" size={16} />} {gatePreview?.gatePassed ? "Automation may proceed" : "Human review recommended"}</p><p className="mt-1">{gatePreview?.gateMessage}</p></div><div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-paper p-3"><p className="text-ink/45">Latency</p><p className="mt-1 font-black">{result.latencyMs} ms</p></div><div className="rounded-xl bg-paper p-3"><p className="text-ink/45">Tokens</p><p className="mt-1 font-black">{result.tokenUsage ?? "—"}</p></div></div><p className="text-xs text-ink/45">{scenario.simulatedAction}</p></div>}</Card>
            <Card className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-ink/45">Safety dial</p><h2 className="mt-2 text-lg font-black">Confidence threshold</h2></div><span className="rounded-full bg-ink px-3 py-1 text-sm font-black text-white">{Math.round(threshold * 100)}%</span></div><input aria-label="Confidence threshold" type="range" min="0.5" max="0.99" step="0.01" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="mt-6 w-full accent-ink" /><div className="mt-2 flex justify-between text-xs text-ink/40"><span>50% · faster</span><span>99% · safer</span></div><p className="mt-5 text-sm leading-6 text-ink/55">Adjusting the gate is client-side only. It never triggers another provider request.</p></Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
