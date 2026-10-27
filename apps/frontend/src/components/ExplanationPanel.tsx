import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Brain, Sparkles } from "lucide-react";
import type { FileExplanation } from "../lib/explainer.api";

interface ExplanationPanelProps {
  explanation: FileExplanation | null;
  isLoading: boolean;
  error: string | null;
}

type SectionKey = "overview" | "flow" | "concepts" | "limitations";

export default function ExplanationPanel({
  explanation,
  isLoading,
  error,
}: ExplanationPanelProps) {
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

  const sections = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "flow" as const, label: "Flow & callers" },
      { key: "concepts" as const, label: "Concepts" },
      {
        key: "limitations" as const,
        label: "Limitations",
        flag: (explanation?.uncertainty.length ?? 0) > 0,
      },
    ],
    [explanation],
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6" aria-live="polite">
        <div className="flex items-center gap-2 text-[13px] text-[#4A4E69]">
          <Brain className="h-4 w-4 animate-pulse text-[#22223B]" />
          <span>Reading this file…</span>
        </div>
        <div className="cn-sheen h-6 w-2/3 rounded-md" />
        <div className="space-y-2.5">
          <div className="cn-sheen h-3 w-full rounded-full" />
          <div className="cn-sheen h-3 w-[90%] rounded-full" />
          <div className="cn-sheen h-3 w-[70%] rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#22223B]/30 bg-[#22223B]/[0.06]">
            <AlertTriangle className="h-5 w-5 text-[#22223B]" />
          </div>
          <p className="mt-3 text-[14px] font-bold">Couldn&apos;t explain this file</p>
          <p className="mt-1 text-[13px] leading-5 text-[#4A4E69]">{error}</p>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#4A4E69]/30 bg-white/60">
            <Sparkles className="h-4 w-4 text-[#4A4E69]" />
          </div>
          <p className="mt-3 text-[13.5px] text-[#4A4E69]">Open a file, then choose Explain file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent text-[#22223B]">
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-b from-[#22223B]/[0.06] to-transparent p-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-bold">
            <Sparkles className="h-3.5 w-3.5" /> AI explanation
          </div>
          <span className="rounded-full border border-[#4A4E69]/35 px-2.5 py-0.5 text-[11px] text-[#4A4E69]">
            Based on the code
          </span>
        </div>
        <h3 className="font-display mt-3 text-[22px] leading-[1.2]">{explanation.fileRole}</h3>
        <p className="mt-2 truncate font-mono text-[11.5px] text-[#5F6380]" title={explanation.filePath}>
          {explanation.filePath}
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex shrink-0 gap-5 border-b border-[#4A4E69]/25 px-5">
        {sections.map((sec) => (
          <button
            key={sec.key}
            type="button"
            role="tab"
            aria-selected={activeSection === sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`relative flex items-center gap-1.5 py-2.5 text-[12.5px] font-medium transition-colors ${
              activeSection === sec.key ? "text-[#22223B]" : "text-[#5F6380] hover:text-[#22223B]"
            }`}
          >
            {sec.label}
            {sec.flag && <span className="h-1.5 w-1.5 rounded-full bg-[#22223B]" />}
            {activeSection === sec.key && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#22223B]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div key={activeSection} role="tabpanel" className="cn-rise custom-scrollbar min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
        {activeSection === "overview" && (
          <>
            <p className="text-[14.5px] leading-7 text-[#2E2F4A]">{explanation.whyExists}</p>
            <Section title="Responsibilities">
              <ul className="space-y-3 text-[13.5px] leading-6 text-[#2E2F4A]">
                {explanation.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-3 h-px w-3 shrink-0 bg-[#22223B]" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {activeSection === "flow" && (
          <Section title="Data flow">
            <p className="whitespace-pre-line rounded-xl bg-[#22223B] p-4 font-mono text-[12px] leading-6 text-[#F2E9E4]/90">
              {explanation.dataFlow}
            </p>
          </Section>
        )}

        {activeSection === "concepts" && (
          <Section title="Key concepts">
            <div className="divide-y divide-[#4A4E69]/20 border-y border-[#4A4E69]/20">
              {explanation.keyConcepts.map((concept, i) => (
                <div key={i} className="py-4">
                  <p className="text-[13.5px] font-bold">{concept.name}</p>
                  <p className="mt-1 text-[13px] leading-6 text-[#4A4E69]">{concept.explanation}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {activeSection === "limitations" && (
          <Section title="Things to double-check">
            <ul className="space-y-2.5">
              {explanation.uncertainty.map((item, i) => (
                <li key={i} className="rounded-lg border-l-2 border-[#22223B] bg-[#22223B]/[0.05] px-3.5 py-2.5 text-[13px] leading-6 text-[#2E2F4A]">
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[13px] font-bold text-[#4A4E69]">{title}</p>
      {children}
    </div>
  );
}