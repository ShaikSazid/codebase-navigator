import type { ReactNode } from "react";

import {
  AlertTriangle,
  ArrowRight,
  Brain,
  ChevronDown,
  GitBranch,
  Info,
  Layers3,
  ListChecks,
  Network,
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
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10">
            <Brain className="h-5 w-5 animate-pulse text-indigo-400" />
          </div>

          <p className="mt-4 text-sm font-medium text-slate-200">
            Understanding this file
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Reading the code, its relationships, and its role in the
            repository.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-xl border border-red-400/10 bg-red-400/[0.03] p-5 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-red-400" />

          <p className="mt-3 text-sm font-medium text-red-200">
            Could not explain this file
          </p>

          <p className="mt-2 text-xs leading-5 text-red-200/50">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <Sparkles className="h-5 w-5 text-slate-600" />
          </div>

          <p className="mt-4 text-sm font-medium text-slate-400">
            Understand this file with AI
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-600">
            Select a source file and choose “Explain with AI”.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar h-full overflow-y-auto">
      <div className="p-4 sm:p-5">
        {/* -------------------------------------------------------
            HEADER
        ------------------------------------------------------- */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10">
              <Brain className="h-4 w-4 text-indigo-400" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-indigo-300">
                  AI Code Guide
                </span>

                <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wide text-emerald-300/70">
                  Grounded
                </span>
              </div>

              <p
                className="mt-1.5 truncate font-mono text-[12px] text-slate-300"
                title={explanation.filePath}
              >
                {explanation.filePath}
              </p>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------
            START HERE
        ------------------------------------------------------- */}
        <section className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Start here
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-400/15 bg-gradient-to-b from-indigo-500/[0.08] to-transparent p-4">
            <p className="text-[15px] font-medium leading-6 text-slate-100">
              {explanation.fileRole}
            </p>

            <p className="mt-3 text-[12px] leading-6 text-slate-400">
              {explanation.whyExists}
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------
            QUICK UNDERSTANDING
        ------------------------------------------------------- */}
        <section className="mt-4">
          <SectionHeading
            icon={<Info className="h-3.5 w-3.5" />}
            title="At a glance"
          />

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InsightCard
              title="What it handles"
              value={
                explanation.responsibilities.length > 0
                  ? `${explanation.responsibilities.length} responsibilities`
                  : "No responsibilities identified"
              }
              icon={<ListChecks className="h-3.5 w-3.5" />}
            />

            <InsightCard
              title="Main code units"
              value={
                explanation.keyFunctions.length > 0
                  ? `${explanation.keyFunctions.length} important units`
                  : "No key units identified"
              }
              icon={<Layers3 className="h-3.5 w-3.5" />}
            />

            <InsightCard
              title="Used by"
              value={
                explanation.usedBy.length > 0
                  ? `${explanation.usedBy.length} caller${
                      explanation.usedBy.length === 1 ? "" : "s"
                    }`
                  : "No known callers"
              }
              icon={<Network className="h-3.5 w-3.5" />}
            />

            <InsightCard
              title="Concepts"
              value={
                explanation.keyConcepts.length > 0
                  ? `${explanation.keyConcepts.length} important concepts`
                  : "No specific concepts identified"
              }
              icon={<GitBranch className="h-3.5 w-3.5" />}
            />
          </div>
        </section>

        {/* -------------------------------------------------------
            RESPONSIBILITIES
        ------------------------------------------------------- */}
        <SectionBlock
          className="mt-5"
          icon={<ListChecks className="h-3.5 w-3.5" />}
          title="What this file is responsible for"
        >
          {explanation.responsibilities.length > 0 ? (
            <div className="space-y-2">
              {explanation.responsibilities.map(
                (responsibility, index) => (
                  <div
                    key={`${responsibility}-${index}`}
                    className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-[10px] font-semibold text-indigo-300">
                      {index + 1}
                    </div>

                    <p className="text-[12px] leading-5 text-slate-400">
                      {responsibility}
                    </p>
                  </div>
                ),
              )}
            </div>
          ) : (
            <EmptyValue />
          )}
        </SectionBlock>

        {/* -------------------------------------------------------
            HOW IT WORKS
        ------------------------------------------------------- */}
        <SectionBlock
          className="mt-5"
          icon={<Layers3 className="h-3.5 w-3.5" />}
          title="How the code works"
        >
          {explanation.keyFunctions.length > 0 ? (
            <div className="relative space-y-2">
              {explanation.keyFunctions.map(
                (fn, index) => (
                  <div
                    key={`${fn.name}-${index}`}
                    className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.018]"
                  >
                    <div className="flex items-start gap-3 px-3.5 py-3.5">
                      <div className="relative flex shrink-0 flex-col items-center">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.06] text-[10px] font-semibold text-cyan-300">
                          {index + 1}
                        </div>

                        {index <
                          explanation.keyFunctions.length - 1 && (
                          <div className="mt-1 h-5 w-px bg-white/[0.06]" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-mono text-[12px] font-medium text-cyan-300">
                          {fn.name}
                        </p>

                        <p className="mt-1.5 text-[12px] leading-6 text-slate-400">
                          {fn.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <EmptyValue />
          )}
        </SectionBlock>

        {/* -------------------------------------------------------
            DATA FLOW
        ------------------------------------------------------- */}
        <SectionBlock
          className="mt-5"
          icon={<GitBranch className="h-3.5 w-3.5" />}
          title="How information moves"
        >
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4">
            <p className="whitespace-pre-line text-[12px] leading-6 text-slate-400">
              {explanation.dataFlow}
            </p>
          </div>
        </SectionBlock>

        {/* -------------------------------------------------------
            CONNECTIONS
        ------------------------------------------------------- */}
        <SectionBlock
          className="mt-5"
          icon={<Network className="h-3.5 w-3.5" />}
          title="Where this file fits"
        >
          {explanation.usedBy.length > 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
              <p className="mb-2 text-[11px] leading-5 text-slate-500">
                Other parts of the repository depend on this file:
              </p>

              <div className="space-y-1.5">
                {explanation.usedBy.map(
                  (item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2"
                    >
                      <ArrowRight className="h-3 w-3 shrink-0 text-indigo-400" />

                      <span className="break-all font-mono text-[11px] text-slate-400">
                        {item}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
              <p className="text-[12px] leading-5 text-slate-500">
                No caller information was available from the repository
                index.
              </p>
            </div>
          )}
        </SectionBlock>

        {/* -------------------------------------------------------
            IMPORTANT CONCEPTS
        ------------------------------------------------------- */}
        <SectionBlock
          className="mt-5"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title="Things to understand"
        >
          {explanation.keyConcepts.length > 0 ? (
            <div className="space-y-2">
              {explanation.keyConcepts.map(
                (concept, index) => (
                  <details
                    key={`${concept.name}-${index}`}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.018]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
                      <span className="font-mono text-[11px] font-medium text-violet-300">
                        {concept.name}
                      </span>

                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="border-t border-white/[0.05] px-3.5 py-3">
                      <p className="text-[12px] leading-6 text-slate-400">
                        {concept.explanation}
                      </p>
                    </div>
                  </details>
                ),
              )}
            </div>
          ) : (
            <EmptyValue />
          )}
        </SectionBlock>

        {/* -------------------------------------------------------
            UNCERTAINTY
        ------------------------------------------------------- */}
        <section className="mt-5">
          <details className="group rounded-xl border border-white/[0.06] bg-white/[0.018]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />

                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Uncertainty & limitations
                </span>
              </div>

              <ChevronDown className="h-3.5 w-3.5 text-slate-600 transition-transform group-open:rotate-180" />
            </summary>

            <div className="border-t border-white/[0.05] px-3.5 py-3.5">
              {explanation.uncertainty.length > 0 ? (
                <div className="space-y-2">
                  {explanation.uncertainty.map(
                    (item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-lg border border-amber-400/10 bg-amber-400/[0.025] px-3 py-2.5"
                      >
                        <p className="text-[12px] leading-5 text-amber-200/60">
                          {item}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-[12px] leading-5 text-emerald-300/60">
                  No important limitations were identified from the supplied
                  repository evidence.
                </p>
              )}
            </div>
          </details>
        </section>

        <p className="mt-5 px-1 text-center text-[10px] leading-5 text-slate-700">
          Explanation generated from source code and repository context.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Supporting components
------------------------------------------------------------------- */

function SectionHeading({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-slate-500">{icon}</span>

      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h2>
    </div>
  );
}

function SectionBlock({
  icon,
  title,
  children,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <SectionHeading
        icon={icon}
        title={title}
      />

      <div className="mt-2">
        {children}
      </div>
    </section>
  );
}

function InsightCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
      <div className="flex items-center gap-2 text-slate-600">
        {icon}

        <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">
          {title}
        </span>
      </div>

      <p className="mt-2 text-[12px] leading-5 text-slate-300">
        {value}
      </p>
    </div>
  );
}

function EmptyValue() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-3">
      <p className="text-[12px] leading-5 text-slate-600">
        No information was identified for this section.
      </p>
    </div>
  );
}