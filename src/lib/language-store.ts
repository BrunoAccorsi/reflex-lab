import { create } from "zustand";
import type { Language } from "@/lib/i18n";

const LANGUAGE_KEY = "jev-lab:language:v1";

type LanguageStore = {
  language: Language;
  hydrated: boolean;
  setLanguage: (language: Language) => void;
  hydrate: () => void;
};

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  language: "en",
  hydrated: false,
  setLanguage: (language) => {
    set({ language });
    if (typeof window !== "undefined")
      window.localStorage.setItem(LANGUAGE_KEY, language);
  },
  hydrate: () => {
    if (get().hydrated) return;
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LANGUAGE_KEY)
        : null;
    set({ language: stored === "pt-BR" ? "pt-BR" : "en", hydrated: true });
  },
}));
