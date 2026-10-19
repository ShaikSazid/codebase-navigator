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
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-[12px] text-[#9E9A92]">
          <Brain className="h-4 w-4 animate-pulse text-[#D4A359]" />
          <span>Analyzing source file…</span>
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
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4A359]/30 bg-[#D4A359]/10">
            <AlertTriangle className="h-5 w-5 text-[#D4A359]" />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#EAE7E0]">Analysis Error</p>
          <p className="mt-1 text-[12px] leading-5 text-[#9E9A92]">{error}</p>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#232326] bg-[#141417]">
            <Sparkles className="h-4 w-4 text-[#726E67]" />
          </div>
          <p className="mt-3 text-[13px] text-[#9E9A92]">Select a file to generate AI insights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent text-[#EAE7E0]">
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-b from-[#D4A359]/[0.06] to-transparent p-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#D4A359]">
            <Sparkles className="h-3.5 w-3.5" /> AI insights
          </div>
          <span className="rounded-full border border-[#2B2B30] bg-[#18181B] px-2.5 py-0.5 text-[10.5px] text-[#9E9A92]">
            Grounded in code
          </span>
        </div>
        <h3 className="font-display mt-3 text-[26px] leading-[1.15] text-[#EAE7E0]">{explanation.fileRole}</h3>
        <p className="mt-2 truncate font-mono text-[11.5px] text-[#726E67]" title={explanation.filePath}>
          {explanation.filePath}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-5 border-b border-[#232326] px-5">
        {sections.map((sec) => (
          <button
            key={sec.key}
            type="button"
            onClick={() => setActiveSection(sec.key)}
            className={`relative flex items-center gap-1.5 py-2.5 text-[12px] font-medium transition-colors ${
              activeSection === sec.key ? "text-[#EAE7E0]" : "text-[#726E67] hover:text-[#9E9A92]"
            }`}
          >
            {sec.label}
            {sec.flag && <span className="h-1.5 w-1.5 rounded-full bg-[#D4A359]" />}
            {activeSection === sec.key && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#D4A359]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div key={activeSection} className="cn-rise custom-scrollbar min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
        {activeSection === "overview" && (
          <>
            <p className="text-[14px] leading-7 text-[#C2C0B8]">{explanation.whyExists}</p>
            <Section title="Responsibilities">
              <ul className="space-y-3 text-[13px] leading-6 text-[#C2C0B8]">
                {explanation.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2.5 h-px w-3 shrink-0 bg-[#D4A359]" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {activeSection === "flow" && (
          <Section title="Data flow">
            <p className="whitespace-pre-line rounded-xl border border-[#232326] bg-[#0E0E10] p-4 font-mono text-[12px] leading-6 text-[#9E9A92]">
              {explanation.dataFlow}
            </p>
          </Section>
        )}

        {activeSection === "concepts" && (
          <Section title="Key concepts">
            <div className="divide-y divide-[#1E1E21] border-y border-[#1E1E21]">
              {explanation.keyConcepts.map((concept, i) => (
                <div key={i} className="py-4">
                  <p className="text-[13px] font-semibold text-[#EAE7E0]">{concept.name}</p>
                  <p className="mt-1 text-[12.5px] leading-6 text-[#9E9A92]">{concept.explanation}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {activeSection === "limitations" && (
          <Section title="Ambiguities">
            <ul className="space-y-2.5">
              {explanation.uncertainty.map((item, i) => (
                <li key={i} className="rounded-lg border-l-2 border-[#D4A359]/60 bg-[#D4A359]/[0.05] px-3.5 py-2.5 text-[12.5px] leading-6 text-[#C2C0B8]">
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
      <p className="mb-3 text-[12px] font-medium text-[#726E67]">{title}</p>
      {children}
    </div>
  );
}