import { experimentDefinitionSchema, type ExperimentDefinitionV1 } from "@/lib/experiments";
import type { ExperimentResult } from "@/lib/evaluation";

const PRESET_KEY = "reflex-lab:presets:v1";
const RESULT_PREFIX = "reflex-lab:previous-result:v1:";

export type StoredPreset = { id: string; name: string; definition: ExperimentDefinitionV1; updatedAt: string };

export function loadPresets(): StoredPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRESET_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Partial<StoredPreset>;
      const definition = experimentDefinitionSchema.safeParse(value.definition);
      return definition.success && typeof value.id === "string" && typeof value.name === "string"
        ? [{ id: value.id, name: value.name, definition: definition.data, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString() }]
        : [];
    });
  } catch {
    return [];
  }
}

export function savePresets(presets: StoredPreset[]) {
  window.localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

export function makePreset(definition: ExperimentDefinitionV1, name = definition.title): StoredPreset {
  const unique = `${definition.id}-${Date.now().toString(36)}`;
  return { id: unique, name, definition: { ...definition, id: unique }, updatedAt: new Date().toISOString() };
}

export function loadPreviousResult(experimentId: string): ExperimentResult | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(`${RESULT_PREFIX}${experimentId}`) ?? "null") as ExperimentResult | null;
    return parsed?.experimentId === experimentId && Array.isArray(parsed.answers) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePreviousResult(result: ExperimentResult) {
  window.sessionStorage.setItem(`${RESULT_PREFIX}${result.experimentId}`, JSON.stringify(result));
}
