import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChevronRight,
  CircleAlert,
  FileCode2,
  GitBranch,
  Loader2,
  Send,
  User,
} from "lucide-react";

import RepositoryTree from "./RepositoryTree";

import type {
  RepositoryTreeNode,
} from "../lib/repository.api";

import {
  askRepositoryQuestion,
  navigateRepositoryQuestion,
  type NavigationBranch,
  type NavigationResult,
  type NavigationStep,
} from "../lib/qa.api";

interface QAChatProps {
  repositoryId: string;

  repositoryTree:
    | RepositoryTreeNode
    | null;

  onSelectFile?: (
    path: string,
    node: RepositoryTreeNode,
  ) => void;
}

interface ChatMessage {
  id: string;

  role:
    | "user"
    | "assistant";

  question?: string;

  answer?: string;

  navigation?: NavigationResult;

  error?: string;
}

export default function QAChat({
  repositoryId,
  repositoryTree,
  onSelectFile,
}: QAChatProps) {
  const [question, setQuestion] =
    useState("");

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Submit Question                                                          */
  /* ------------------------------------------------------------------------ */

  async function handleSubmitQuestion(
    value: string,
  ) {
    const trimmedQuestion =
      value.trim();

    if (
      !trimmedQuestion ||
      isLoading ||
      !repositoryId
    ) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      question:
        trimmedQuestion,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setQuestion("");
    setError(null);
    setIsLoading(true);

    try {
      /*
       * Run RAG and graph navigation
       * concurrently.
       */
      const [
        answerResult,
        navigationResult,
      ] = await Promise.all([
        askRepositoryQuestion(
          trimmedQuestion,
          repositoryId,
        ),

        navigateRepositoryQuestion(
          trimmedQuestion,
          repositoryId,
        ),
      ]);

      const assistantMessage:
        ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        answer:
          answerResult.answer,
        navigation:
          navigationResult.navigation,
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch (requestError) {
      console.error(
        "Q&A request failed",
        requestError,
      );

      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to answer this question.";

      setError(message);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          error:
            "I could not answer this question. Please check that the repository analysis and Q&A service are running.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(
    event?: FormEvent,
  ) {
    event?.preventDefault();

    await handleSubmitQuestion(
      question,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="flex h-[calc(100vh-140px)] w-full gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Repository Tree                                                     */}
      {/* ------------------------------------------------------------------ */}

      <div className="w-[300px] shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
        {repositoryTree ? (
          <RepositoryTree
            tree={repositoryTree}
            onSelectFile={
              onSelectFile ??
              (() => undefined)
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-slate-400">
            Repository tree is not available.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Chat                                                                 */}
      {/* ------------------------------------------------------------------ */}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#08090D]">
        {/* Header */}

        <div className="shrink-0 border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-500/10">
              <Bot className="h-4 w-4 text-indigo-300" />
            </div>

            <div>
              <p className="text-[14px] font-medium text-white">
                AI Codebase Q&A
              </p>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Ask questions about how this repository works.
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState
              onAsk={(value) => {
                setQuestion(value);

                void handleSubmitQuestion(
                  value,
                );
              }}
            />
          ) : (
            <div className="mx-auto w-full max-w-[1000px] space-y-8 px-6 py-8">
              {messages.map(
                (message) => (
                  <Message
                    key={message.id}
                    message={message}
                  />
                ),
              )}

              {isLoading && (
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-500/10">
                    <Bot className="h-4 w-4 text-indigo-300" />
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[13px] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />

                    <span>
                      Analyzing the codebase...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}

        {error && (
          <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-300">
            <CircleAlert className="h-3.5 w-3.5 shrink-0" />

            <span>
              {error}
            </span>
          </div>
        )}

        {/* Input */}

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-white/[0.08] bg-[#07080C] p-4"
        >
          <div className="mx-auto flex max-w-[1000px] items-end gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-2 transition-colors focus-within:border-indigo-400/30">
            <textarea
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  void handleSubmit();
                }
              }}
              disabled={isLoading}
              rows={1}
              placeholder="Ask about this codebase..."
              className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={
                isLoading ||
                !question.trim()
              }
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[12px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}

              <span>
                Ask
              </span>
            </button>
          </div>

          <p className="mx-auto mt-2 max-w-[1000px] text-[10px] text-slate-600">
            Answers are grounded in indexed repository code and graph relationships.
          </p>
        </form>
      </section>
    </div>
  );
}

/* ========================================================================== */
/* Empty State                                                                */
/* ========================================================================== */

function EmptyState({
  onAsk,
}: {
  onAsk: (
    question: string,
  ) => void;
}) {
  const examples = [
    "How is a new listing created?",
    "Where is authentication handled?",
    "How does the application fetch listings?",
    "What happens when a listing is deleted?",
  ];

  return (
    <div className="flex h-full min-h-[500px] flex-col items-center justify-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10">
        <Bot className="h-5 w-5 text-indigo-300" />
      </div>

      <h2 className="mt-5 text-[17px] font-medium text-white">
        Ask about this codebase
      </h2>

      <p className="mt-2 max-w-md text-center text-[13px] leading-6 text-slate-500">
        Ask how a feature works, where something is implemented, what calls what, or how data moves through the application.
      </p>

      <div className="mt-7 grid w-full max-w-[700px] gap-2 sm:grid-cols-2">
        {examples.map(
          (example) => (
            <button
              key={example}
              type="button"
              onClick={() =>
                onAsk(example)
              }
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left text-[12px] text-slate-400 transition-colors hover:border-indigo-400/20 hover:bg-indigo-500/[0.04] hover:text-slate-200"
            >
              {example}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Message                                                                    */
/* ========================================================================== */

function Message({
  message,
}: {
  message: ChatMessage;
}) {
  if (
    message.role === "user"
  ) {
    return (
      <div className="flex gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <User className="h-4 w-4 text-slate-400" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-600">
            You
          </p>

          <p className="whitespace-pre-wrap text-[14px] leading-7 text-slate-200">
            {message.question}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-500/10">
        <Bot className="h-4 w-4 text-indigo-300" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-indigo-400">
          AI explanation
        </p>

        {message.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-300">
            <CircleAlert className="h-4 w-4 shrink-0" />

            {message.error}
          </div>
        ) : (
          <>
            {message.answer && (
              <div className="whitespace-pre-wrap text-[14px] leading-7 text-slate-300">
                {message.answer}
              </div>
            )}

            {message.navigation && (
              <NavigationView
                navigation={
                  message.navigation
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Navigation                                                                 */
/* ========================================================================== */

function NavigationView({
  navigation,
}: {
  navigation: NavigationResult;
}) {
  return (
    <div className="mt-7 space-y-7">
      {/* Execution Flow */}

      {navigation.steps.length >
        0 && (
        <section>
          <SectionHeader
            icon={
              <GitBranch className="h-3.5 w-3.5" />
            }
            title="Execution flow"
          />

          <div className="mt-4">
            {navigation.steps.map(
              (
                step,
                index,
              ) => (
                <NavigationStepCard
                  key={`${step.filePath}-${step.symbol}-${step.order}`}
                  step={step}
                  isLast={
                    index ===
                    navigation.steps.length -
                      1
                  }
                />
              ),
            )}
          </div>
        </section>
      )}

      {/* Related branches */}

      {navigation.branches.length >
        0 && (
        <Branches
          branches={
            navigation.branches
          }
        />
      )}

      {/* Sources */}

      {navigation.steps.length >
        0 && (
        <Sources
          steps={
            navigation.steps
          }
        />
      )}
    </div>
  );
}

/* ========================================================================== */
/* Navigation Step Card                                                       */
/* ========================================================================== */

function NavigationStepCard({
  step,
  isLast,
}: {
  step: NavigationStep;
  isLast: boolean;
}) {
  return (
    <div>
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 font-mono text-[11px] text-indigo-300">
            {step.order}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <FileCode2 className="h-3.5 w-3.5 text-slate-500" />

              <span className="font-mono text-[12px] text-slate-200">
                {step.filePath}
              </span>

              {step.symbol && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-700" />

                  <span className="font-mono text-[12px] text-indigo-300">
                    {step.symbol}
                  </span>
                </>
              )}
            </div>

            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-600">
              {step.kind && (
                <span>
                  {step.kind}
                </span>
              )}

              <span>
                lines {step.startLine}–
                {step.endLine}
              </span>
            </div>

            <p className="mt-3 text-[12px] leading-6 text-slate-400">
              {step.explanation}
            </p>

            {step.relationshipEvidence && (
              <p className="mt-2 font-mono text-[10px] text-slate-600">
                evidence:{" "}
                {
                  step
                    .relationshipEvidence
                    .filePath
                }
                :
                {
                  step
                    .relationshipEvidence
                    .startLine
                }
                –
                {
                  step
                    .relationshipEvidence
                    .endLine
                }
              </p>
            )}
          </div>
        </div>
      </div>

      {!isLast && (
        <RelationshipConnector
          relationship={
            step.relationshipFromPrevious
          }
        />
      )}
    </div>
  );
}

/* ========================================================================== */
/* Relationship Connector                                                     */
/* ========================================================================== */

function RelationshipConnector({
  relationship,
}: {
  relationship?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 pl-3">
      <div className="flex flex-col items-center">
        <div className="h-3 w-px bg-indigo-400/20" />

        <ChevronRight className="h-3 w-3 rotate-90 text-indigo-400/60" />

        <div className="h-3 w-px bg-indigo-400/20" />
      </div>

      <span className="rounded-md border border-indigo-400/10 bg-indigo-500/[0.04] px-2 py-1 font-mono text-[10px] text-indigo-300/70">
        {relationship ??
          "related"}
      </span>
    </div>
  );
}

/* ========================================================================== */
/* Branches                                                                   */
/* ========================================================================== */

function Branches({
  branches,
}: {
  branches: NavigationBranch[];
}) {
  const [open, setOpen] =
    useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
        className="flex w-full items-center justify-between border-b border-white/[0.07] pb-3 text-left"
      >
        <SectionHeader
          icon={
            <GitBranch className="h-3.5 w-3.5" />
          }
          title={`Related paths (${branches.length})`}
        />

        {open ? (
          <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {branches.map(
            (branch, index) => (
              <div
                key={`${branch.filePath}-${branch.symbol}-${index}`}
                className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-3.5 w-3.5 text-slate-600" />

                  <span className="font-mono text-[11px] text-slate-300">
                    {branch.filePath}
                  </span>

                  {branch.symbol && (
                    <>
                      <ChevronRight className="h-3 w-3 text-slate-700" />

                      <span className="font-mono text-[11px] text-indigo-300/80">
                        {branch.symbol}
                      </span>
                    </>
                  )}
                </div>

                <p className="mt-1 text-[10px] text-slate-600">
                  {branch.relationship}
                  {" · "}
                  lines{" "}
                  {branch.startLine}–
                  {branch.endLine}
                </p>

                {branch.explanation && (
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                    {
                      branch.explanation
                    }
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

/* ========================================================================== */
/* Sources                                                                    */
/* ========================================================================== */

function Sources({
  steps,
}: {
  steps: NavigationStep[];
}) {
  const sources = Array.from(
    new Map(
      steps.map((step) => [
        `${step.filePath}:${step.startLine}`,
        step,
      ]),
    ).values(),
  );

  return (
    <section>
      <SectionHeader
        icon={
          <FileCode2 className="h-3.5 w-3.5" />
        }
        title="Sources"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {sources.map(
          (source) => (
            <div
              key={`${source.filePath}-${source.startLine}`}
              className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2"
            >
              <p className="font-mono text-[10px] text-slate-300">
                {source.filePath}
              </p>

              <p className="mt-0.5 font-mono text-[9px] text-slate-600">
                lines{" "}
                {source.startLine}–
                {source.endLine}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Section Header                                                             */
/* ========================================================================== */

function SectionHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
      {icon}

      <span>
        {title}
      </span>
    </div>
  );
}