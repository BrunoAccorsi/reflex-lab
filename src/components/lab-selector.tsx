"use client";

import Image from "next/image";
import { ArrowRight, ChevronDown, PanelLeftClose } from "lucide-react";
import { type ExperimentDefinitionV1 } from "@/lib/experiments";
import { accentStyles } from "@/lib/experiment-theme";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-toggle";

type LabSelectorProps = {
  catalog: ExperimentDefinitionV1[];
  selected: ExperimentDefinitionV1;
  desktopMenuOpen: boolean;
  mobileMenuOpen: boolean;
  onDesktopMenuToggle: () => void;
  onMobileMenuToggle: () => void;
  onSelect: (id: string) => void;
};

export function LabSelector({
  catalog,
  selected,
  desktopMenuOpen,
  mobileMenuOpen,
  onDesktopMenuToggle,
  onMobileMenuToggle,
  onSelect,
}: LabSelectorProps) {
  const { t } = useLanguage();
  return (
    <aside className="relative min-w-0 lg:sticky lg:top-6">
      <div
        className={cn(
          "mb-3 hidden items-center gap-2 lg:flex",
          desktopMenuOpen ? "justify-between" : "justify-center",
        )}
      >
        <p
          className={cn(
            "max-w-menu-label overflow-hidden whitespace-nowrap text-xs font-black uppercase tracking-label text-ink/45 transition-menu-label duration-500 ease-out motion-reduce:transition-none",
            desktopMenuOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none max-w-0 -translate-x-2 opacity-0",
          )}
        >
          {t("capabilityLabs")}
        </p>
        <button
          type="button"
          aria-label={desktopMenuOpen ? t("collapseLabs") : t("expandLabs")}
          aria-expanded={desktopMenuOpen}
          onClick={() => onDesktopMenuToggle()}
          className="group grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white text-ink shadow-card transition-all duration-500 hover:scale-105 hover:bg-paper motion-reduce:transition-none"
        >
          {desktopMenuOpen ? (
            <span className="transition-transform duration-500 ease-smooth motion-reduce:transition-none group-hover:-translate-x-0.5">
              <PanelLeftClose size={19} />
            </span>
          ) : (
            <Image
              src="/icon.svg"
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
              className="rounded-lg transition-transform duration-500 ease-smooth motion-reduce:transition-none group-hover:scale-110"
            />
          )}
        </button>
      </div>
      <button
        type="button"
        aria-controls="lab-menu"
        aria-expanded={mobileMenuOpen}
        onClick={() => onMobileMenuToggle()}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left shadow-card lg:hidden"
      >
        <span className="min-w-0">
          <span className="block text-xs font-black uppercase tracking-meta text-ink/45">
            {t("capabilityLabs")}
          </span>
          <span className="mt-1 block truncate text-sm font-bold">
            {selected.title}
          </span>
        </span>
        <ChevronDown
          size={19}
          className={cn(
            "shrink-0 transition-transform",
            mobileMenuOpen && "rotate-180",
          )}
        />
      </button>
      <nav
        id="lab-menu"
        className={cn(
          "mt-2 grid gap-2 transition-menu duration-300 ease-out motion-reduce:transition-none sm:grid-cols-2 lg:relative lg:mt-0 lg:grid-cols-1",
          mobileMenuOpen ? "grid" : "hidden lg:grid",
          desktopMenuOpen
            ? "lg:visible lg:pointer-events-auto lg:translate-x-0 lg:opacity-100"
            : "lg:absolute lg:invisible lg:pointer-events-none lg:-translate-x-3 lg:opacity-0",
        )}
        aria-label={t("decisionExperiments")}
      >
        {catalog.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            aria-current={item.id === selected.id ? "page" : undefined}
            className={cn(
              "group flex min-w-0 w-full items-center justify-between gap-2 rounded-2xl p-3 text-left transition",
              item.id === selected.id
                ? "bg-white shadow-card"
                : "hover:bg-white/60",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black",
                  accentStyles[item.accent],
                )}
              >
                {item.eyebrow.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-5">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-ink/45">
                  {item.eyebrow}
                </span>
              </span>
            </span>
            <ArrowRight
              className={cn(
                "shrink-0 opacity-0 transition group-hover:opacity-50",
                item.id === selected.id && "opacity-100",
              )}
              size={16}
            />
          </button>
        ))}
      </nav>
      <nav
        className={cn(
          "hidden flex-col gap-2 transition-menu duration-300 ease-out motion-reduce:transition-none lg:flex",
          desktopMenuOpen
            ? "lg:pointer-events-none lg:invisible lg:absolute lg:scale-95 lg:opacity-0"
            : "lg:visible lg:translate-x-0 lg:scale-100 lg:opacity-100",
        )}
        aria-label={t("compactDecisionExperiments")}
      >
        {catalog.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            title={item.title}
            aria-label={item.title}
            aria-current={item.id === selected.id ? "page" : undefined}
            className={cn(
              "grid h-12 w-12 place-items-center rounded-xl transition",
              item.id === selected.id
                ? "bg-white shadow-card ring-1 ring-ink/10"
                : "hover:bg-white/60",
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg text-xs font-black",
                accentStyles[item.accent],
              )}
            >
              {item.eyebrow.slice(0, 2)}
            </span>
          </button>
        ))}
      </nav>
      <div
        className={cn(
          "grain mt-8 hidden overflow-hidden rounded-3xl bg-grain transition-evidence duration-500 ease-out motion-reduce:transition-none lg:block",
          desktopMenuOpen
            ? "max-h-56 translate-y-0 p-5 opacity-100"
            : "pointer-events-none max-h-0 -translate-y-2 p-0 opacity-0",
        )}
      >
        <p className="text-xs font-black uppercase tracking-kicker text-ink/50">
          {t("typedEvidence")}
        </p>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          {t("typedEvidenceBody")}
        </p>
      </div>
    </aside>
  );
}
