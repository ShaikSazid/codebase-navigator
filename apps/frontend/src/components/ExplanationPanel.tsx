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
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <Brain className="mx-auto h-5 w-5 animate-pulse text-[#EAE7E0]" />
          <p className="mt-3 font-mono text-[11px] text-[#726E67]">ANALYZING SOURCE FILE…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-xs">
          <AlertTriangle className="mx-auto h-5 w-5 text-[#D4A359]" />
          <p className="mt-2 text-[13px] font-semibold text-[#EAE7E0]">Analysis Error</p>
          <p className="mt-1 text-[12px] text-[#9E9A92]">{error}</p>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <Sparkles className="mx-auto h-5 w-5 text-[#55534F]" />
          <p className="mt-2 text-[13px] text-[#9E9A92]">Select a file to generate AI insights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent font-sans text-[#EAE7E0]">
      {/* Drawer Header */}
      <div className="shrink-0 border-b border-[#232326] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#726E67]">
            <Brain className="h-3.5 w-3.5 text-[#EAE7E0]" /> AI INSIGHTS
          </div>
          <span className="rounded-full bg-[#18181B] px-2 py-0.5 font-mono text-[9.5px] text-[#9E9A92]">Grounded</span>
        </div>
        <p className="mt-2 truncate font-mono text-[12px] text-[#EAE7E0]">{explanation.filePath}</p>
        <p className="mt-1 text-[13px] font-medium text-[#C2C0B8]">{explanation.fileRole}</p>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-[#232326] px-3 py-1.5">
        {sections.map((sec) => (
          <button
            key={sec.key}
            type="button"
            onClick={() => setActiveSection(sec.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeSection === sec.key ? "bg-[#222226] text-[#EAE7E0]" : "text-[#726E67] hover:text-[#9E9A92]"
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 space-y-6">
        {activeSection === "overview" && (
          <>
            <p className="text-[13px] leading-6 text-[#9E9A92]">{explanation.whyExists}</p>
            <Section title="Responsibilities">
              <ul className="space-y-2 text-[13px] text-[#C2C0B8]">
                {explanation.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-[11px] text-[#726E67]">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {activeSection === "flow" && (
          <Section title="Data Flow">
            <p className="whitespace-pre-line font-mono text-[12px] leading-6 text-[#9E9A92]">{explanation.dataFlow}</p>
          </Section>
        )}

        {activeSection === "concepts" && (
          <Section title="Key Concepts">
            <div className="space-y-2">
              {explanation.keyConcepts.map((concept, i) => (
                <div key={i} className="rounded-lg border border-[#232326] bg-[#111113] p-3">
                  <p className="text-[12.5px] font-medium text-[#EAE7E0]">{concept.name}</p>
                  <p className="mt-1 text-[12px] text-[#9E9A92]">{concept.explanation}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {activeSection === "limitations" && (
          <Section title="Ambiguities">
            <ul className="space-y-1.5 text-[12.5px] text-[#9E9A92]">
              {explanation.uncertainty.map((item, i) => (
                <li key={i}>• {item}</li>
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
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#726E67]">{title}</p>
      {children}
    </div>
  );
}