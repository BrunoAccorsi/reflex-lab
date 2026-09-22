import { describe, expect, it } from "vitest";
import {
  blankExperiment,
  experimentDefinitionSchema,
  experiments,
} from "@/lib/experiments";
import {
  getCopy,
  localizeDefinition,
  localizedBlankExperiment,
  localizedExperiments,
  localizeValue,
} from "@/lib/i18n";
import english from "@/locales/en.json";
import portuguese from "@/locales/pt-BR.json";

describe("localization", () => {
  it("keeps both UI dictionaries in sync", () => {
    expect(Object.keys(portuguese.ui).sort()).toEqual(
      Object.keys(english).sort(),
    );
  });

  it("provides valid localized definitions for every built-in and the blank template", () => {
    expect(Object.keys(portuguese.definitions).sort()).toEqual(
      [
        ...experiments.map((experiment) => experiment.id),
        blankExperiment.id,
      ].sort(),
    );

    for (const definition of [
      ...localizedExperiments("pt-BR"),
      localizedBlankExperiment("pt-BR"),
    ]) {
      expect(
        experimentDefinitionSchema.safeParse(definition).success,
        definition.id,
      ).toBe(true);
    }
  });

  it("does not change canonical English definitions", () => {
    const original = experiments[0];
    const before = structuredClone(original);
    expect(localizeDefinition(original, "en")).toBe(original);
    expect(localizeDefinition(original, "pt-BR").title).not.toBe(
      original.title,
    );
    expect(original).toEqual(before);
    expect(getCopy("en")("capabilityLabs")).toBe("Capability labs");
  });

  it("uses stable option keys and localizes only their display values", () => {
    expect(localizeValue("billing", "pt-BR")).toBe("cobrança");
    expect(localizeValue("claudeOpus", "pt-BR")).toBe("Claude Opus");
    expect(localizeValue("billing", "en")).toBe("billing");
    expect(localizeValue("custom-option", "pt-BR")).toBe("custom-option");
  });
});
