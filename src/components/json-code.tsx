"use client";

import { Braces, Check, Copy, WandSparkles } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";

function JsonSyntax({ text }: { text: string }) {
  const tokens = useMemo(() => {
    const nodes: ReactNode[] = [];
    const pattern =
      /"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b|[{}\[\],:]/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      if (start > offset) nodes.push(text.slice(offset, start));
      const token = match[0];
      const key =
        token.startsWith('"') && /^\s*:/.test(text.slice(start + token.length));
      nodes.push(
        <span
          key={start}
          className={
            key
              ? "text-sky"
              : token.startsWith('"')
                ? "text-gold"
                : /^(true|false|null)$/.test(token)
                  ? "text-lavender"
                  : /^-?\d/.test(token)
                    ? "text-coral"
                    : "text-white/45"
          }
        >
          {token}
        </span>,
      );
      offset = start + token.length;
    }
    nodes.push(text.slice(offset));
    return nodes;
  }, [text]);
  return <>{tokens}</>;
}

function CopyJson({ text }: { text: string }) {
  const { t } = useLanguage();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const copied = copiedText === text;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {failed && (
        <span role="status" className="text-xs text-coral">
          {t("copyJsonFailed")}
        </span>
      )}
      <Button
        aria-label={t("copyJson")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
        className="border border-white/15 text-white/80"
      >
        {copied ? (
          <Check size={14} className="mr-2" />
        ) : (
          <Copy size={14} className="mr-2" />
        )}
        <span role="status">
          {copied ? (
            t("copied")
          ) : (
            <>
              <span className="hidden sm:inline">{t("copyJson")}</span>
              <span className="sm:hidden">{t("copyJsonShort")}</span>
            </>
          )}
        </span>
      </Button>
    </div>
  );
}

export function JsonEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (text: string) => void;
  label: string;
}) {
  const { t } = useLanguage();
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const parsed = useMemo(() => {
    try {
      return {
        valid: true,
        formatted: JSON.stringify(JSON.parse(value), null, 2),
      };
    } catch {
      return { valid: false, formatted: value };
    }
  }, [value]);
  const lineCount = value.split("\n").length;

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-ink/10 bg-code shadow-card focus-within:ring-2 focus-within:ring-sky/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <Braces size={16} className="text-sky" />
          <span className="font-mono text-xs font-bold text-white/80">
            JSON
          </span>
          <span
            className={parsed.valid ? "text-xs text-sky" : "text-xs text-coral"}
          >
            {parsed.valid ? t("validJson") : t("invalidJson")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-label={t("formatJson")}
            disabled={!parsed.valid}
            title={!parsed.valid ? t("formatJsonHelp") : undefined}
            onClick={() => onChange(parsed.formatted)}
            className="border border-white/15 text-white/80"
          >
            <WandSparkles size={14} className="mr-2" />
            <span className="hidden sm:inline">{t("formatJson")}</span>
            <span className="sm:hidden">{t("formatJsonShort")}</span>
          </Button>
          <CopyJson text={value} />
        </div>
      </div>
      <div className="relative">
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="json-editor-highlight json-editor-overlay pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-5 pl-16 text-white"
        >
          <JsonSyntax text={value + (value.endsWith("\n") ? " " : "")} />
        </pre>
        <pre
          ref={gutterRef}
          aria-hidden="true"
          className="json-editor-gutter pointer-events-none absolute inset-y-0 left-0 z-10 w-12 overflow-hidden border-r border-white/10 bg-code py-5 pr-3 text-right text-white/30"
        >
          {Array.from({ length: lineCount }, (_, index) => index + 1).join(
            "\n",
          )}
        </pre>
        <textarea
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            const { scrollTop, scrollLeft } = event.currentTarget;
            if (highlightRef.current) {
              highlightRef.current.scrollTop = scrollTop;
              highlightRef.current.scrollLeft = scrollLeft;
            }
            if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
          }}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="json-editor-input relative block min-h-editor w-full resize-y overflow-auto bg-transparent p-5 pl-16 outline-none"
        />
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-white/40">
        <span>
          {lineCount} {t("jsonLines")}
        </span>
        <span>{t("jsonIndent")}</span>
      </div>
    </div>
  );
}

export function JsonViewer({
  value,
  label,
}: {
  value: unknown;
  label: string;
}) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-code">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/5 p-3">
        <span className="text-xs font-bold text-white/70">{label}</span>
        <CopyJson text={text} />
      </div>
      <pre
        aria-label={label}
        tabIndex={0}
        className="json-editor-highlight max-h-80 overflow-auto p-4 text-white focus-visible:outline-sky"
      >
        <JsonSyntax text={text} />
      </pre>
    </div>
  );
}
