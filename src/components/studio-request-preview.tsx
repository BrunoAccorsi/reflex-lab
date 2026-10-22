"use client";

import { Braces } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { JsonEditor } from "@/components/json-code";
import { useLanguage } from "@/components/language-toggle";
import {
  experimentDefinitionSchema,
  type ExperimentDefinitionV1,
} from "@/lib/experiments";
import { buildDecisionRequest } from "@/lib/jev-request";

export function StudioRequestPreview({
  definition,
  model,
  stateText,
  stateError,
  updateState,
}: {
  definition: ExperimentDefinitionV1;
  model: string;
  stateText: string;
  stateError: string | null;
  updateState: (text: string) => void;
}) {
  const { t } = useLanguage();

  const preview = useMemo(() => {
    try {
      const parsed = experimentDefinitionSchema.parse(definition);
      const { request } = buildDecisionRequest(
        { definition: parsed, state: parsed.sampleState },
        model,
      );
      return { text: JSON.stringify(request, null, 2), error: null };
    } catch (error) {
      return {
        text: "",
        error:
          error instanceof z.ZodError
            ? error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("\n")
            : error instanceof Error
              ? error.message
              : t("invalidRequest"),
      };
    }
  }, [definition, model, t]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-black">
          <Braces size={17} /> {t("jevRequestJson")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/55">
          {t("jevRequestHelp")}
        </p>
        <p className="mt-2 break-all font-mono text-xs text-ink/50">
          POST https://openrouter.ai/api/alpha/decisions
        </p>
      </div>
      <details className="rounded-xl border border-ink/10 bg-paper p-4">
        <summary className="cursor-pointer text-sm font-bold">
          {t("editRequestState")}
        </summary>
        <p className="my-3 text-xs leading-5 text-ink/55">
          {t("requestStateHelp")}
        </p>
        <JsonEditor
          label={t("requestStateJson")}
          value={stateText}
          compact
          onChange={updateState}
        />
      </details>
      {stateError || preview.error ? (
        <div
          role="alert"
          className="rounded-xl border border-coral/30 bg-coral/10 p-4"
        >
          <p className="text-sm font-bold text-danger-foreground">
            {t("invalidRequest")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-danger-foreground">
            {stateError ?? preview.error}
          </p>
        </div>
      ) : (
        <JsonEditor label={t("jevRequestJson")} value={preview.text} readOnly />
      )}
    </div>
  );
}
