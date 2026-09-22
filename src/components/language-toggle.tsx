"use client";

import { useEffect, useMemo } from "react";
import { getCopy, languageLabel } from "@/lib/i18n";
import { useLanguageStore } from "@/lib/language-store";

export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const hydrate = useLanguageStore((state) => state.hydrate);

  useEffect(() => hydrate(), [hydrate]);

  return {
    language,
    setLanguage,
    t: useMemo(() => getCopy(language), [language]),
    languageLabel: languageLabel(language),
  };
}

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div
      className="inline-flex items-center rounded-full border border-ink/10 bg-white p-1 shadow-card"
      aria-label={t("language")}
    >
      <button
        type="button"
        aria-pressed={language === "en"}
        aria-label={t("english")}
        onClick={() => setLanguage("en")}
        className={`rounded-full px-2.5 py-1.5 text-xs font-black transition ${language === "en" ? "bg-ink text-white" : "text-ink/45 hover:text-ink"}`}
      >
        <span aria-hidden="true">{t("englishFlag")}</span>
        <span className="ml-1 hidden sm:inline">EN</span>
      </button>
      <button
        type="button"
        aria-pressed={language === "pt-BR"}
        aria-label={t("portuguese")}
        onClick={() => setLanguage("pt-BR")}
        className={`rounded-full px-2.5 py-1.5 text-xs font-black transition ${language === "pt-BR" ? "bg-ink text-white" : "text-ink/45 hover:text-ink"}`}
      >
        <span aria-hidden="true">{t("portugueseFlag")}</span>
        <span className="ml-1 hidden sm:inline">PT</span>
      </button>
    </div>
  );
}
