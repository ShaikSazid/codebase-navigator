import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  CircleAlert,
  FileCode2,
  GitBranch,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";

import type { RepositoryTreeNode } from "../lib/repository.api";

import {
  askRepositoryQuestion,
  navigateRepositoryQuestion,
  type NavigationBranch,
  type NavigationResult,
  type NavigationStep,
} from "../lib/qa.api";

interface QAChatProps {
  repositoryId: string;
  /** No longer used by the chat UI; kept optional so existing callers keep compiling. */
  repositoryTree?: RepositoryTreeNode | null;
  onSelectFile?: (path: string, node: RepositoryTreeNode) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  question?: string;
  answer?: string;
  navigation?: NavigationResult;
  error?: string;
}

export default function QAChat({ repositoryId }: QAChatProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) scrollToBottom();
  }, [messages, isLoading]);

  // Auto-grow the composer up to a max height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [question]);

  // Return focus to the composer when a response finishes
  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpToLatest(distanceFromBottom > 200);
  };

  async function handleSubmitQuestion(value: string) {
    const trimmedQuestion = value.trim();
    if (!trimmedQuestion || isLoading || !repositoryId) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      question: trimmedQuestion,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setIsLoading(true);

    try {
      const [answerResult, navigationResult] = await Promise.all([
        askRepositoryQuestion(trimmedQuestion, repositoryId),
        navigateRepositoryQuestion(trimmedQuestion, repositoryId),
      ]);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        answer: answerResult.answer,
        navigation: navigationResult.navigation,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      console.error("Q&A request failed", requestError);
      const message = requestError instanceof Error ? requestError.message : "Unable to answer.";

      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          error: "Could not fetch codebase response. Verify backend Q&A services.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    await handleSubmitQuestion(question);
  }

  return (
    <section className="relative flex h-[calc(100vh-125px)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#232326] bg-[#0E0E10]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_-30%,rgba(212,163,89,0.09),transparent_70%)]" />

      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-between border-b border-[#1E1E21] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-[#D4A359]" />
          <p className="text-[13.5px] font-semibold tracking-tight text-[#EAE7E0]">Ask the codebase</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#726E67]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D4A359] shadow-[0_0_8px_1px_rgba(212,163,89,0.6)]" />
          Semantic navigation ready
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState
            onAsk={(val) => {
              setQuestion(val);
              void handleSubmitQuestion(val);
            }}
          />
        ) : (
          <div className="mx-auto w-full max-w-[760px] space-y-10 px-6 py-10">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}

            {isLoading && <Thinking />}
          </div>
        )}
      </div>

      {showJumpToLatest && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#2B2B30] bg-[#18181B]/95 px-3.5 py-1.5 text-[12px] text-[#EAE7E0] shadow-xl backdrop-blur-md transition-colors hover:border-[#D4A359]/50"
        >
          <ArrowDown className="h-3 w-3" /> Jump to latest
        </button>
      )}

      {error && (
        <div className="relative mx-auto mb-2 flex w-full max-w-[760px] items-center gap-2 rounded-lg border border-[#D4A359]/30 bg-[#D4A359]/[0.07] px-3 py-2 text-[12px] text-[#EAE7E0]">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[#D4A359]" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="relative shrink-0 px-4 pb-4 pt-1">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#0E0E10] to-transparent" />

        <div className="mx-auto flex max-w-[760px] items-end gap-2 rounded-2xl border border-[#2B2B30] bg-[#141417] p-2 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.9)] transition-all focus-within:border-[#D4A359]/50 focus-within:shadow-[0_0_0_4px_rgba(212,163,89,0.08),0_10px_40px_-12px_rgba(0,0,0,0.9)]">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={isLoading}
            rows={1}
            placeholder="Ask anything about this repository..."
            className="custom-scrollbar max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-[14px] leading-5 text-[#EAE7E0] outline-none placeholder:text-[#55534F] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            aria-label="Send question"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#EAE7E0] text-[#0D0D0E] transition-all hover:bg-[#FAF8F5] active:scale-95 disabled:cursor-not-allowed disabled:opacity-20"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[#55534F]">Enter to send · Shift + Enter for a new line</p>
      </form>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty + loading                                                            */
/* -------------------------------------------------------------------------- */

function EmptyState({ onAsk }: { onAsk: (q: string) => void }) {
  const examples = [
    "How is a new listing created?",
    "Where is authentication handled?",
    "How does the application fetch listings?",
    "What happens when a listing is deleted?",
  ];

  return (
    <div className="cn-rise flex h-full min-h-[420px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4A359]/30 bg-[#D4A359]/10 shadow-[0_0_50px_-8px_rgba(212,163,89,0.55)]">
        <Sparkles className="h-5 w-5 text-[#D4A359]" />
      </div>
      <h2 className="font-display mt-6 text-[44px] leading-none text-[#EAE7E0]">Ask about this codebase</h2>
      <p className="mt-3 max-w-sm text-[13.5px] leading-6 text-[#9E9A92]">
        Trace execution paths, find where things live, and understand how the pieces connect.
      </p>

      <div className="mt-9 grid w-full max-w-[640px] gap-2.5 sm:grid-cols-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onAsk(example)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-[#232326] bg-[#121214] px-4 py-3.5 text-left text-[13px] text-[#9E9A92] transition-all hover:-translate-y-px hover:border-[#D4A359]/40 hover:bg-[#161619] hover:text-[#EAE7E0]"
          >
            <span>{example}</span>
            <ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 text-[#454340] transition-colors group-hover:text-[#D4A359]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="cn-rise flex items-start gap-3.5">
      <AssistantAvatar active />
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2.5 text-[13px] text-[#9E9A92]">
          <span className="flex gap-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A359]"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
          <span>Searching code graph...</span>
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="cn-sheen h-3 w-full rounded-full" />
          <div className="cn-sheen h-3 w-[88%] rounded-full" />
          <div className="cn-sheen h-3 w-[60%] rounded-full" />
        </div>
      </div>
    </div>
  );
}

function AssistantAvatar({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
        active ? "border-[#D4A359]/30 bg-[#D4A359]/10" : "border-[#2B2B30] bg-[#141417]"
      }`}
    >
      <Sparkles className="h-4 w-4 text-[#D4A359]" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Messages                                                                   */
/* -------------------------------------------------------------------------- */

function Message({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.answer) return;
    try {
      await navigator.clipboard.writeText(message.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (message.role === "user") {
    return (
      <div className="cn-rise flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-[#2B2B30] bg-[#1A1A1D] px-4 py-2.5 text-[#EAE7E0]">
          <p className="whitespace-pre-wrap text-[14px] leading-6">{message.question}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cn-rise flex items-start gap-3.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {message.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#D4A359]/30 bg-[#D4A359]/[0.06] px-3.5 py-2.5 text-[13px] text-[#C2C0B8]">
            <CircleAlert className="h-4 w-4 shrink-0 text-[#D4A359]" />
            {message.error}
          </div>
        ) : (
          <>
            {message.answer && (
              <div className="group/answer relative">
                <RichText text={message.answer} />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#726E67] opacity-0 transition-opacity hover:text-[#EAE7E0] focus-visible:opacity-100 group-hover/answer:opacity-100"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy answer"}</span>
                </button>
              </div>
            )}
            {message.navigation && <NavigationView navigation={message.navigation} />}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rich text: paragraphs, **bold**, `inline code`, ``` code blocks ```        */
/* -------------------------------------------------------------------------- */

function RichText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-4">
      {parts.map((part, index) => {
        if (part.length >= 6 && part.startsWith("```") && part.endsWith("```")) {
          return <CodeBlock key={index} raw={part} />;
        }
        if (!part.trim()) return null;
        return part
          .trim()
          .split(/\n{2,}/)
          .map((block, blockIndex) => (
            <p
              key={`${index}-${blockIndex}`}
              className="whitespace-pre-wrap text-[14.5px] leading-7 text-[#D2D0C8]"
            >
              <Inline text={block} />
            </p>
          ));
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  const pieces = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {pieces.map((piece, index) => {
        if (piece.length > 2 && piece.startsWith("`") && piece.endsWith("`")) {
          return (
            <code
              key={index}
              className="rounded-md border border-[#232326] bg-[#171719] px-1.5 py-0.5 font-mono text-[12.5px] text-[#E8C48A]"
            >
              {piece.slice(1, -1)}
            </code>
          );
        }
        if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-[#EAE7E0]">
              {piece.slice(2, -2)}
            </strong>
          );
        }
        return <span key={index}>{piece}</span>;
      })}
    </>
  );
}

function CodeBlock({ raw }: { raw: string }) {
  const [copied, setCopied] = useState(false);

  const inner = raw.slice(3, -3);
  const newline = inner.indexOf("\n");
  const firstLine = newline === -1 ? "" : inner.slice(0, newline).trim();
  const hasLang = newline !== -1 && /^[\w+#.-]*$/.test(firstLine);
  const language = hasLang ? firstLine : "";
  const code = (hasLang ? inner.slice(newline + 1) : inner).replace(/\n+$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#232326] bg-[#0B0B0C]">
      <div className="flex items-center justify-between border-b border-[#1B1B1E] bg-[#111113] px-3.5 py-2">
        <span className="font-mono text-[11px] text-[#726E67]">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-[#726E67] transition-colors hover:text-[#EAE7E0]"
        >
          {copied ? <Check className="h-3 w-3 text-[#D4A359]" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="custom-scrollbar overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-[#C2C0B8]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Navigation (execution flow, related paths, sources)                        */
/* -------------------------------------------------------------------------- */

function NavigationView({ navigation }: { navigation: NavigationResult }) {
  return (
    <div className="mt-7 space-y-6 border-t border-[#1E1E21] pt-6">
      {navigation.steps.length > 0 && <ExecutionFlow steps={navigation.steps} />}
      {navigation.branches.length > 0 && <Branches branches={navigation.branches} />}
      {navigation.steps.length > 0 && <Sources steps={navigation.steps} />}
    </div>
  );
}

function ExecutionFlow({ steps }: { steps: NavigationStep[] }) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between"
      >
        <SectionHeader icon={<GitBranch className="h-3.5 w-3.5" />} title="Execution flow" count={steps.length} />
        <ChevronRight
          className={`h-3.5 w-3.5 text-[#726E67] transition-transform duration-200 group-hover:text-[#EAE7E0] ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="cn-rise mt-4">
          {steps.map((step, index) => (
            <NavigationStepCard
              key={`${step.filePath}-${step.symbol}-${step.order}`}
              step={step}
              isLast={index === steps.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NavigationStepCard({ step, isLast }: { step: NavigationStep; isLast: boolean }) {
  return (
    <div className="flex gap-3.5">
      {/* Timeline rail */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D4A359]/50 bg-[#D4A359]/10 font-mono text-[10.5px] text-[#E8C48A]">
          {step.order}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-[#D4A359]/40 to-[#232326]" />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-2"}`}>
        <div className="rounded-xl border border-[#232326] bg-[#121214] p-3.5 transition-colors hover:border-[#2F2F35]">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-[#EAE7E0]">
            <FileCode2 className="h-3.5 w-3.5 text-[#726E67]" />
            <span className="break-all">{step.filePath}</span>
            {step.symbol && (
              <>
                <ChevronRight className="h-3 w-3 text-[#454340]" />
                <span className="text-[#E8C48A]">{step.symbol}</span>
              </>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-6 text-[#9E9A92]">{step.explanation}</p>
        </div>
        {!isLast && <RelationshipConnector relationship={step.relationshipFromPrevious} />}
      </div>
    </div>
  );
}

function RelationshipConnector({ relationship }: { relationship?: string }) {
  return (
    <div className="py-2.5">
      <span className="rounded-full border border-[#232326] bg-[#141417] px-2.5 py-0.5 text-[11px] text-[#726E67]">
        {relationship ?? "related"}
      </span>
    </div>
  );
}

function Branches({ branches }: { branches: NavigationBranch[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between"
      >
        <SectionHeader icon={<GitBranch className="h-3.5 w-3.5" />} title="Related paths" count={branches.length} />
        <ChevronRight
          className={`h-3.5 w-3.5 text-[#726E67] transition-transform duration-200 group-hover:text-[#EAE7E0] ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="cn-rise mt-3 space-y-2">
          {branches.map((branch, index) => (
            <div
              key={`${branch.filePath}-${index}`}
              className="rounded-xl border border-[#232326] bg-[#121214] p-3 font-mono text-[11.5px]"
            >
              <div className="flex items-center gap-1.5 text-[#EAE7E0]">
                <FileCode2 className="h-3.5 w-3.5 text-[#726E67]" />
                <span className="break-all">{branch.filePath}</span>
              </div>
              {branch.explanation && (
                <p className="mt-1.5 font-sans text-[12.5px] leading-5 text-[#9E9A92]">{branch.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Sources({ steps }: { steps: NavigationStep[] }) {
  const sources = Array.from(new Map(steps.map((step) => [`${step.filePath}:${step.startLine}`, step])).values());
  return (
    <section>
      <SectionHeader icon={<FileCode2 className="h-3.5 w-3.5" />} title="Sources" count={sources.length} />
      <div className="mt-3 flex flex-wrap gap-2">
        {sources.map((source) => (
          <div
            key={`${source.filePath}-${source.startLine}`}
            className="rounded-lg border border-[#232326] bg-[#121214] px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:border-[#D4A359]/40"
          >
            <span className="text-[#EAE7E0]">{source.filePath}</span>
            <span className="ml-1.5 text-[#D4A359]/80">
              L{source.startLine}–{source.endLine}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ icon, title, count }: { icon: ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium text-[#9E9A92]">
      <span className="text-[#D4A359]">{icon}</span>
      <span>{title}</span>
      {typeof count === "number" && (
        <span className="rounded-full bg-[#1B1B1E] px-1.5 py-px font-mono text-[10px] text-[#726E67]">{count}</span>
      )}
    </div>
  );
}