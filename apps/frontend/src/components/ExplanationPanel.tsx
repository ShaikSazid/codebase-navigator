import type { ReactNode } from "react";

import {
  AlertTriangle,
  ArrowRight,
  Brain,
  ChevronDown,
  Sparkles,
} from "lucide-react";

import type { FileExplanation } from "../lib/explainer.api";

interface ExplanationPanelProps {
  explanation: FileExplanation | null;
  isLoading: boolean;
  error: string | null;
}

export default function ExplanationPanel({
  explanation,
  isLoading,
  error,
}: ExplanationPanelProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="text-center">
          <Brain className="mx-auto h-6 w-6 animate-pulse text-indigo-400" />
          <p className="mt-3 text-sm text-slate-300">Analyzing file architecture…</p>
          <p className="mt-1 text-xs text-slate-500">Parsing source tree & relationships</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-xs text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-rose-400" />
          <p className="mt-3 text-sm font-medium text-rose-300">Analysis error</p>
          <p className="mt-1.5 text-[13px] leading-5 text-rose-200/60">{error}</p>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="text-center">
          <Sparkles className="mx-auto h-6 w-6 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">Select a file to inspect</p>
          <p className="mt-1 text-xs text-slate-600">
            Choose &quot;Explain with AI&quot; in the source panel
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-transparent font-sans">
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-9">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Brain className="h-3.5 w-3.5 text-indigo-400" />
              AI code guide
            </div>
            <p
              className="mt-1.5 truncate font-mono text-[13px] text-slate-200"
              title={explanation.filePath}
            >
              {explanation.filePath}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            Grounded
          </span>
        </div>

        {/* Overview */}
        <section>
          <p className="text-[15px] font-medium leading-6 text-slate-100">
            {explanation.fileRole}
          </p>
          <p className="mt-2 text-[13.5px] leading-6 text-slate-400">
            {explanation.whyExists}
          </p>
        </section>

        {/* Responsibilities */}
        <Section title="Responsibilities">
          {explanation.responsibilities.length > 0 ? (
            <ol className="space-y-2.5">
              {explanation.responsibilities.map((responsibility, index) => (
                <li key={`${responsibility}-${index}`} className="flex gap-3 text-[13.5px] leading-5 text-slate-300">
                  <span className="mt-0.5 shrink-0 text-slate-600">{index + 1}.</span>
                  {responsibility}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyValue />
          )}

          {/* Key Functions / Code Units */}
          {explanation.keyFunctions.length > 0 && (
            <div className="mt-5 space-y-3">
              {explanation.keyFunctions.map((fn, index) => (
                <div
                  key={`${fn.name}-${index}`}
                  className="overflow-hidden rounded-lg border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-white/[0.03]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-[12.5px] text-cyan-300">
                        {fn.name}
                      </span>
                      {fn.kind && (
                        <span className="text-[10.5px] text-slate-500">{fn.kind}</span>
                      )}
                    </div>

                    {fn.startLine !== undefined && fn.endLine !== undefined && (
                      <span className="shrink-0 font-mono text-[10.5px] text-slate-500">
                        L{fn.startLine}–{fn.endLine}
                      </span>
                    )}
                  </div>

                  {fn.code && <CodeSnippet code={fn.code} startLine={fn.startLine} />}

                  <p className="px-3.5 py-2.5 text-[12.5px] leading-5 text-slate-400 bg-[#0A0B0E]">
                    {fn.explanation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Data Flow */}
        <Section title="Information flow">
          <p className="whitespace-pre-line font-mono text-[12.5px] leading-6 text-slate-300">
            {explanation.dataFlow}
          </p>
        </Section>

        {/* Callers & Dependencies */}
        <Section title="Dependencies & callers">
          {explanation.usedBy.length > 0 ? (
            <ul className="space-y-1.5">
              {explanation.usedBy.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-center gap-2 text-[12.5px] text-slate-300">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  <span className="break-all font-mono">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] italic text-slate-500">
              No caller information identified from the repository index.
            </p>
          )}
        </Section>

        {/* Key Concepts */}
        <Section title="Important concepts">
          {explanation.keyConcepts.length > 0 ? (
            <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {explanation.keyConcepts.map((concept, index) => (
                <details key={`${concept.name}-${index}`} className="group py-2.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-slate-200">
                      {concept.name}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-open:rotate-180" />
                  </summary>

                  <p className="mt-2 text-[13px] leading-5 text-slate-400">
                    {concept.explanation}
                  </p>
                </details>
              ))}
            </div>
          ) : (
            <EmptyValue />
          )}
        </Section>

        {/* Limitations & Uncertainty */}
        <Section title="Limitations & uncertainty" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}>
          {explanation.uncertainty.length > 0 ? (
            <ul className="space-y-2">
              {explanation.uncertainty.map((item, index) => (
                <li key={`${item}-${index}`} className="text-[13px] leading-5 text-amber-200/80">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-emerald-400/80">
              High confidence. No significant ambiguities identified.
            </p>
          )}
        </Section>

        <p className="pt-2 text-center text-[11px] text-slate-600">
          Generated from repository AST and context.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function CodeSnippet({ code, startLine }: { code: string; startLine?: number }) {
  const lines = code.split(/\r?\n/);
  const firstLine = startLine ?? 1;

  return (
    <div className="max-h-[280px] overflow-auto bg-[#07080B]">
      <pre className="min-w-max py-2 font-mono text-[11px] leading-5">
        {lines.map((line, index) => {
          const lineNumber = firstLine + index;

          return (
            <div key={`${lineNumber}-${index}`} className="grid grid-cols-[38px_1fr] px-3.5">
              <span className="select-none pr-3 text-right text-slate-600">{lineNumber}</span>
              <code className="whitespace-pre text-slate-300">{line || "\u00A0"}</code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function EmptyValue() {
  return <p className="text-[13px] italic text-slate-500">No information available for this section.</p>;
}