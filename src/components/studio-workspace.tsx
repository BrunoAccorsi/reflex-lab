"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ZodError } from "zod";
import {
  ArrowLeft,
  ChartNetwork,
  Check,
  Copy,
  Download,
  FilePlus2,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import {
  blankExperiment,
  experimentDefinitionSchema,
  experiments,
  type ExperimentDefinitionV1,
} from "@/lib/experiments";
import {
  localizeDefinition,
  localizedBlankExperiment,
  localizedExperiments,
} from "@/lib/i18n";
import {
  loadPresets,
  makePreset,
  savePresets,
  type StoredPreset,
} from "@/lib/presets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageToggle, useLanguage } from "@/components/language-toggle";
import {
  StudioEditorPanels,
  type EditorTab,
} from "@/components/studio-editor-panels";

const editorTabs: EditorTab[] = ["Definition", "Questions", "Policy", "JSON"];
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validationMessages(error: unknown) {
  if (error instanceof ZodError)
    return error.issues.map(
      (issue) => `${issue.path.join(".") || "$"}: ${issue.message}`,
    );
  return [error instanceof Error ? error.message : "Invalid JSON"];
}

export function StudioWorkspace() {
  const { language, t } = useLanguage();
  const [definition, setDefinition] = useState<ExperimentDefinitionV1>(() =>
    clone(experiments[0]),
  );
  const [baseline, setBaseline] = useState<ExperimentDefinitionV1>(() =>
    clone(experiments[0]),
  );
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(experiments[0], null, 2),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<EditorTab>("Definition");
  const [presets, setPresets] = useState<StoredPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => setPresets(loadPresets()), []);
  useEffect(() => {
    const builtin = experiments.find((item) => item.id === definition.id);
    if (builtin) {
      const next = clone(localizeDefinition(builtin, language));
      setDefinition(next);
      setBaseline(next);
      setJsonText(JSON.stringify(next, null, 2));
    } else if (definition.id === blankExperiment.id) {
      const next = clone(localizedBlankExperiment(language));
      setDefinition(next);
      setBaseline(next);
      setJsonText(JSON.stringify(next, null, 2));
    }
  }, [definition.id, language]);

  const validation = useMemo(
    () => experimentDefinitionSchema.safeParse(definition),
    [definition],
  );
  const templates = useMemo(() => localizedExperiments(language), [language]);
  function update(next: ExperimentDefinitionV1) {
    setDefinition(next);
    setJsonText(JSON.stringify(next, null, 2));
    setErrors([]);
  }
  function openDefinition(
    next: ExperimentDefinitionV1,
    presetId: string | null,
  ) {
    const copy = clone(next);
    setBaseline(copy);
    update(copy);
    setActivePresetId(presetId);
  }
  function chooseTemplate(id: string) {
    const next =
      id === "blank"
        ? clone(localizedBlankExperiment(language))
        : clone(templates.find((item) => item.id === id) ?? templates[0]);
    openDefinition(next, null);
    setNotice(t("templateLoaded"));
  }
  function choosePreset(id: string) {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    openDefinition(preset.definition, id);
    setNotice(`${t("editingPreset")}: ${preset.name}`);
  }
  function persist(nextPresets: StoredPreset[]) {
    setPresets(nextPresets);
    savePresets(nextPresets);
  }
  function save() {
    const parsed = experimentDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      setErrors(validationMessages(parsed.error));
      setTab("JSON");
      return;
    }
    if (activePresetId) {
      const next = presets.map((preset) =>
        preset.id === activePresetId
          ? {
              ...preset,
              name: parsed.data.title,
              definition: parsed.data,
              updatedAt: new Date().toISOString(),
            }
          : preset,
      );
      persist(next);
      setBaseline(clone(parsed.data));
      setNotice(t("presetSaved"));
    } else {
      const preset = makePreset(parsed.data);
      persist([...presets, preset]);
      openDefinition(preset.definition, preset.id);
      setNotice(t("presetCreated"));
    }
  }
  function duplicate() {
    const name = `${definition.title} ${t("copySuffix")}`;
    const copy = makePreset({ ...definition, title: name }, name);
    persist([...presets, copy]);
    openDefinition(copy.definition, copy.id);
    setNotice(t("presetDuplicated"));
  }
  function removePreset() {
    if (!activePresetId) return;
    persist(presets.filter((preset) => preset.id !== activePresetId));
    chooseTemplate(experiments[0].id);
    setNotice(t("presetRemoved"));
  }
  function exportDefinition() {
    const blob = new Blob([JSON.stringify(definition, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${definition.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function importDefinition(file: File) {
    try {
      const parsed = experimentDefinitionSchema.parse(
        JSON.parse(await file.text()) as unknown,
      );
      const preset = makePreset(parsed);
      persist([...presets, preset]);
      openDefinition(preset.definition, preset.id);
      setNotice(t("presetImported"));
    } catch (error) {
      setErrors(validationMessages(error));
      setTab("JSON");
    }
  }
  function updateJson(text: string) {
    setJsonText(text);
    try {
      const parsed = experimentDefinitionSchema.parse(
        JSON.parse(text) as unknown,
      );
      setDefinition(parsed);
      setErrors([]);
    } catch (error) {
      setErrors(validationMessages(error));
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-studio px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">
              <ChartNetwork size={19} />
            </div>
            <div>
              <p className="text-lg font-black">{t("studioTitle")}</p>
              <p className="text-xs font-semibold uppercase tracking-label text-ink/45">
                {t("studioSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/"
              className="inline-flex items-center text-sm font-bold"
            >
              <ArrowLeft size={16} className="mr-2" /> {t("backToLabs")}
            </Link>
          </div>
        </header>
        <div className="grid gap-7 py-8 lg:grid-cols-studio">
          <aside className="space-y-5">
            <Card className="p-5">
              <p className="text-xs font-black uppercase tracking-wider text-ink/45">
                {t("startFrom")}
              </p>
              <select
                aria-label={t("builtInTemplate")}
                value=""
                onChange={(event) => chooseTemplate(event.target.value)}
                className="mt-3 w-full rounded-xl border border-ink/10 bg-paper p-3 text-sm font-bold"
              >
                <option value="" disabled>
                  {t("chooseTemplate")}
                </option>
                <option value="blank">{t("blankExperiment")}</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => chooseTemplate("blank")}
                className="mt-3 w-full border border-ink/10"
              >
                <FilePlus2 size={15} className="mr-2" /> {t("newBlank")}
              </Button>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-ink/45">
                  {t("browserPresets")}
                </p>
                <span className="rounded-full bg-paper px-2 py-1 text-xs font-black">
                  {presets.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {presets.length === 0 ? (
                  <p className="text-sm leading-6 text-ink/45">
                    {t("savedPresets")}
                  </p>
                ) : (
                  presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => choosePreset(preset.id)}
                      className={cn(
                        "w-full rounded-xl p-3 text-left text-sm font-bold",
                        activePresetId === preset.id
                          ? "bg-ink text-white"
                          : "bg-paper hover:bg-ink/10",
                      )}
                    >
                      {preset.name}
                    </button>
                  ))
                )}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-xs leading-5 text-ink/50">
                {notice ?? t("templateLoaded")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={save} className="bg-ink text-white">
                  <Save size={14} className="mr-2" /> {t("save")}
                </Button>
                <Button onClick={duplicate} className="border border-ink/10">
                  <Copy size={14} className="mr-2" /> {t("duplicate")}
                </Button>
                <Button
                  onClick={() => update(clone(baseline))}
                  className="border border-ink/10"
                >
                  <RotateCcw size={14} className="mr-2" /> {t("reset")}
                </Button>
                <Button
                  onClick={exportDefinition}
                  className="border border-ink/10"
                >
                  <Download size={14} className="mr-2" /> {t("export")}
                </Button>
                <Button
                  onClick={() => importRef.current?.click()}
                  className="border border-ink/10"
                >
                  <Upload size={14} className="mr-2" /> {t("import")}
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importDefinition(file);
                  }}
                />
                {activePresetId && (
                  <Button
                    onClick={removePreset}
                    className="border border-coral/30 text-coral"
                  >
                    <Trash2 size={14} className="mr-2" /> {t("delete")}
                  </Button>
                )}
              </div>
            </Card>
          </aside>
          <section className="min-w-0">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink/45">
                  <Wrench size={14} /> {t("experimentDefinition")}
                </div>
                <h1 className="mt-2 text-4xl font-black tracking-tight">
                  {definition.title}
                </h1>
                <p className="mt-2 max-w-3xl text-ink/55">{t("visualJson")}</p>
              </div>
              <div
                className={cn(
                  "rounded-full px-3 py-2 text-xs font-black",
                  validation.success
                    ? "bg-moss/15 text-moss"
                    : "bg-coral/15 text-coral",
                )}
              >
                {validation.success ? (
                  <>
                    <Check size={14} className="mr-1 inline" />{" "}
                    {t("validSchema")}
                  </>
                ) : (
                  `${validation.error.issues.length} ${t("validationErrors")}`
                )}
              </div>
            </div>
            <Card className="overflow-hidden">
              <div className="flex gap-1 overflow-x-auto border-b border-ink/10 px-4 pt-3">
                {editorTabs.map((item) => (
                  <button
                    key={item}
                    onClick={() => setTab(item)}
                    className={cn(
                      "border-b-2 px-4 py-3 text-sm font-bold",
                      tab === item
                        ? "border-ink"
                        : "border-transparent text-ink/40",
                    )}
                  >
                    {item === "Definition"
                      ? t("definition")
                      : item === "Questions"
                        ? t("questions")
                        : item === "Policy"
                          ? t("policy")
                          : t("json")}
                  </button>
                ))}
              </div>
              <div className="p-5 sm:p-7">
                <StudioEditorPanels
                  tab={tab}
                  definition={definition}
                  jsonText={jsonText}
                  errors={errors}
                  update={update}
                  updateJson={updateJson}
                />
              </div>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
