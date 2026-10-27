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
    <section className="relative flex h-[calc(100vh-125px)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#4A4E69]/25 bg-[#FBF6F3]">
      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-between border-b border-[#4A4E69]/20 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4" />
          <h2 className="font-display text-[15px]">Ask about this repository</h2>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#4A4E69]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22223B]" />
          Ready
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
      >
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
          className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#22223B] px-3.5 py-1.5 text-[12.5px] text-[#F2E9E4] shadow-lg transition-colors hover:bg-[#4A4E69]"
        >
          <ArrowDown className="h-3 w-3" /> Jump to latest
        </button>
      )}

      {error && (
        <div role="alert" className="relative mx-auto mb-2 flex w-full max-w-[760px] items-center gap-2 rounded-lg border border-[#22223B]/30 bg-[#22223B]/[0.05] px-3 py-2 text-[12.5px]">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="relative shrink-0 px-4 pb-4 pt-1">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#FBF6F3] to-transparent" />

        <div className="mx-auto flex max-w-[760px] items-end gap-2 rounded-[1.6rem] border border-[#4A4E69]/40 bg-white/70 p-2 transition-colors focus-within:border-[#22223B]">
          <label htmlFor="qa-question" className="sr-only">Your question</label>
          <textarea
            id="qa-question"
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
            placeholder="Ask anything about this repository"
            className="custom-scrollbar max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-[14.5px] leading-5 text-[#22223B] outline-none placeholder:text-[#6B6F88] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            aria-label="Send question"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#22223B] text-[#F2E9E4] transition-colors hover:bg-[#4A4E69] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-[#5F6380]">Enter to send, Shift+Enter for a new line</p>
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
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22223B]">
        <Sparkles className="h-5 w-5 text-[#F2E9E4]" />
      </div>
      <h2 className="font-display mt-6 text-[34px] leading-[1.05]">Ask about this codebase</h2>
      <p className="mt-3 max-w-sm text-[14px] leading-6 text-[#4A4E69]">
        Find where things live, trace how a request flows, and see which files are involved.
      </p>

      <div className="mt-9 grid w-full max-w-[640px] gap-2.5 sm:grid-cols-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onAsk(example)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-[#4A4E69]/30 bg-white/60 px-4 py-3.5 text-left text-[13.5px] text-[#2E2F4A] transition-colors hover:border-[#22223B] hover:bg-white"
          >
            <span>{example}</span>
            <ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 text-[#5F6380] transition-colors group-hover:text-[#22223B]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="cn-rise flex items-start gap-3.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2.5 text-[13.5px] text-[#4A4E69]">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#22223B]"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
          <span>Searching the code…</span>
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

function AssistantAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#22223B]">
      <Sparkles className="h-4 w-4 text-[#F2E9E4]" />
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
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#22223B] px-4 py-2.5 text-[#F2E9E4]">
          <p className="whitespace-pre-wrap text-[14.5px] leading-6">{message.question}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cn-rise flex items-start gap-3.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {message.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#22223B]/30 bg-[#22223B]/[0.05] px-3.5 py-2.5 text-[13.5px] text-[#2E2F4A]">
            <CircleAlert className="h-4 w-4 shrink-0" />
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
                  className="mt-3 flex items-center gap-1.5 text-[12px] text-[#5F6380] opacity-0 transition-opacity hover:text-[#22223B] focus-visible:opacity-100 group-hover/answer:opacity-100"
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
              className="whitespace-pre-wrap text-[15px] leading-7 text-[#22223B]"
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
              className="rounded-md bg-[#22223B]/[0.08] px-1.5 py-0.5 font-mono text-[12.5px] text-[#22223B]"
            >
              {piece.slice(1, -1)}
            </code>
          );
        }
        if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**")) {
          return (
            <strong key={index} className="font-bold">
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
    <div className="cn-dark overflow-hidden rounded-xl bg-[#22223B]">
      <div className="flex items-center justify-between border-b border-[#4A4E69]/60 px-3.5 py-2">
        <span className="font-mono text-[11px] text-[#F2E9E4]/60">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11.5px] text-[#F2E9E4]/65 transition-colors hover:text-[#F2E9E4]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="custom-scrollbar overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-[#F2E9E4]">
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
    <div className="mt-7 space-y-6 border-t border-[#4A4E69]/20 pt-6">
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
        aria-expanded={open}
        className="group flex w-full items-center justify-between"
      >
        <SectionHeader icon={<GitBranch className="h-3.5 w-3.5" />} title="Execution flow" count={steps.length} />
        <ChevronRight
          className={`h-3.5 w-3.5 text-[#5F6380] transition-transform duration-200 group-hover:text-[#22223B] ${
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
      {/* Timeline rail: this is a real sequence, so the steps are numbered */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#22223B] font-mono text-[10.5px] text-[#F2E9E4]">
          {step.order}
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#4A4E69]/35" />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-2"}`}>
        <div className="rounded-xl border border-[#4A4E69]/25 bg-white/60 p-3.5">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
            <FileCode2 className="h-3.5 w-3.5 text-[#4A4E69]" />
            <span className="break-all font-medium">{step.filePath}</span>
            {step.symbol && (
              <>
                <ChevronRight className="h-3 w-3 text-[#6B6F88]" />
                <span className="text-[#4A4E69]">{step.symbol}</span>
              </>
            )}
          </div>
          <p className="mt-2 text-[13.5px] leading-6 text-[#4A4E69]">{step.explanation}</p>
        </div>
        {!isLast && <RelationshipConnector relationship={step.relationshipFromPrevious} />}
      </div>
    </div>
  );
}

function RelationshipConnector({ relationship }: { relationship?: string }) {
  return (
    <div className="py-2.5">
      <span className="rounded-full border border-[#4A4E69]/30 bg-white/60 px-2.5 py-0.5 text-[11.5px] text-[#4A4E69]">
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
        aria-expanded={open}
        className="group flex w-full items-center justify-between"
      >
        <SectionHeader icon={<GitBranch className="h-3.5 w-3.5" />} title="Related paths" count={branches.length} />
        <ChevronRight
          className={`h-3.5 w-3.5 text-[#5F6380] transition-transform duration-200 group-hover:text-[#22223B] ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="cn-rise mt-3 space-y-2">
          {branches.map((branch, index) => (
            <div
              key={`${branch.filePath}-${index}`}
              className="rounded-xl border border-[#4A4E69]/25 bg-white/60 p-3 font-mono text-[11.5px]"
            >
              <div className="flex items-center gap-1.5">
                <FileCode2 className="h-3.5 w-3.5 text-[#4A4E69]" />
                <span className="break-all font-medium">{branch.filePath}</span>
              </div>
              {branch.explanation && (
                <p className="mt-1.5 font-sans text-[13px] leading-5 text-[#4A4E69]">{branch.explanation}</p>
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
            className="rounded-full border border-[#4A4E69]/30 bg-white/60 px-3 py-1.5 font-mono text-[11px]"
          >
            <span>{source.filePath}</span>
            <span className="ml-1.5 text-[#4A4E69]">
              lines {source.startLine}–{source.endLine}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ icon, title, count }: { icon: ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold">
      <span className="text-[#4A4E69]">{icon}</span>
      <span>{title}</span>
      {typeof count === "number" && (
        <span className="rounded-full bg-[#22223B]/[0.08] px-1.5 py-px font-mono text-[10px] font-normal text-[#4A4E69]">{count}</span>
      )}
    </div>
  );
}