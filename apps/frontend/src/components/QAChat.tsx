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
  Bot,
  Check,
  ChevronRight,
  Copy,
  CircleAlert,
  FileCode2,
  GitBranch,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  User,
} from "lucide-react";

import RepositoryTree from "./RepositoryTree";

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
  repositoryTree: RepositoryTreeNode | null;
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

export default function QAChat({
  repositoryId,
  repositoryTree,
  onSelectFile,
}: QAChatProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

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
    <div className="flex h-[calc(100vh-125px)] w-full gap-3 font-sans">
      {/* Repository Tree Drawer */}
      <div
        className={`shrink-0 overflow-hidden rounded-xl border border-[#232326] bg-[#141417] transition-all duration-300 ${
          isTreeOpen ? "w-[280px]" : "w-0 border-0"
        }`}
      >
        <div className="h-full w-[280px] p-2.5">
          {repositoryTree ? (
            <RepositoryTree tree={repositoryTree} onSelectFile={onSelectFile ?? (() => undefined)} />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[12px] text-[#726E67]">
              Tree unavailable.
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#232326] bg-[#111113]">
        {/* Header */}
        <div className="shrink-0 border-b border-[#232326] bg-[#141417] px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTreeOpen((v) => !v)}
              title={isTreeOpen ? "Hide file tree" : "Show file tree"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#232326] bg-[#18181B] text-[#9E9A92] hover:border-[#38373B] hover:text-[#EAE7E0]"
            >
              {isTreeOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#232326] bg-[#18181B]">
              <Bot className="h-4 w-4 text-[#EAE7E0]" />
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[#EAE7E0]">AI Codebase Navigator</p>
              <p className="text-[11px] text-[#726E67]">Ask structural questions about flow, functions, or imports.</p>
            </div>
          </div>
        </div>

        {/* Message Viewport */}
        <div ref={scrollRef} onScroll={handleScroll} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onAsk={(val) => { setQuestion(val); void handleSubmitQuestion(val); }} />
          ) : (
            <div className="mx-auto w-full max-w-[800px] space-y-6 px-6 py-6">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#232326] bg-[#141417]">
                    <Bot className="h-4 w-4 text-[#9E9A92]" />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-xs border border-[#232326] bg-[#141417] px-4 py-3 text-[13px] text-[#9E9A92]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#EAE7E0]" />
                    <span>Searching code graph...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showJumpToLatest && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#232326] bg-[#18181B] px-3.5 py-1.5 font-mono text-[11px] text-[#EAE7E0] shadow-md hover:border-[#38373B]"
          >
            <ArrowDown className="h-3 w-3" /> Jump to latest
          </button>
        )}

        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-[#38373B] bg-[#18181B] px-3 py-2 text-[12px] text-[#EAE7E0]">
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[#D4A359]" />
            <span>{error}</span>
          </div>
        )}

        {/* Console Input Bar */}
        <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#232326] bg-[#0E0E10] p-3">
          <div className="mx-auto flex max-w-[800px] items-end gap-2 rounded-xl border border-[#232326] bg-[#141417] p-2 focus-within:border-[#38373B]">
            <textarea
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
              placeholder="Ask a question about this repository..."
              className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-3 py-2 text-[13px] text-[#EAE7E0] outline-none placeholder:text-[#55534F]"
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#EAE7E0] px-4 font-semibold text-[12px] text-[#0D0D0E] transition-all hover:bg-[#FAF8F5] disabled:opacity-20 cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Ask</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EmptyState({ onAsk }: { onAsk: (q: string) => void }) {
  const examples = [
    "How is a new listing created?",
    "Where is authentication handled?",
    "How does the application fetch listings?",
    "What happens when a listing is deleted?",
  ];

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#232326] bg-[#141417]">
        <Bot className="h-5 w-5 text-[#EAE7E0]" />
      </div>
      <h2 className="mt-4 text-[16px] font-semibold text-[#EAE7E0]">Ask about this codebase</h2>
      <p className="mt-1.5 max-w-sm text-[13px] text-[#9E9A92]">
        Query execution pathways, architectural choices, dependencies, or key domain logic.
      </p>

      <div className="mt-6 grid w-full max-w-[640px] gap-2 sm:grid-cols-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onAsk(example)}
            className="rounded-lg border border-[#232326] bg-[#141417] p-3 text-left font-mono text-[11.5px] text-[#9E9A92] transition-all hover:border-[#38373B] hover:text-[#EAE7E0]"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

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
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-row-reverse items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#232326] bg-[#18181B]">
            <User className="h-3.5 w-3.5 text-[#9E9A92]" />
          </div>
          <div className="rounded-2xl rounded-tr-xs bg-[#EAE7E0] px-4 py-2.5 text-[13.5px] text-[#0D0D0E]">
            <p className="whitespace-pre-wrap leading-6">{message.question}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[92%] items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#232326] bg-[#141417]">
          <Bot className="h-3.5 w-3.5 text-[#EAE7E0]" />
        </div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-xs border border-[#232326] bg-[#141417] px-4 py-3">
          {message.error ? (
            <div className="flex items-center gap-2 text-[13px] text-[#9E9A92]">
              <CircleAlert className="h-4 w-4 text-[#D4A359]" />
              {message.error}
            </div>
          ) : (
            <>
              {message.answer && (
                <div className="group/answer relative">
                  <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-[#C2C0B8]">
                    {message.answer}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-[#726E67] opacity-0 transition-opacity hover:text-[#EAE7E0] group-hover/answer:opacity-100"
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
    </div>
  );
}

function NavigationView({ navigation }: { navigation: NavigationResult }) {
  return (
    <div className="mt-5 space-y-5 border-t border-[#232326] pt-4">
      {navigation.steps.length > 0 && (
        <section>
          <SectionHeader icon={<GitBranch className="h-3.5 w-3.5" />} title="Execution flow" />
          <div className="mt-3 space-y-2">
            {navigation.steps.map((step, index) => (
              <NavigationStepCard
                key={`${step.filePath}-${step.symbol}-${step.order}`}
                step={step}
                isLast={index === navigation.steps.length - 1}
              />
            ))}
          </div>
        </section>
      )}
      {navigation.branches.length > 0 && <Branches branches={navigation.branches} />}
      {navigation.steps.length > 0 && <Sources steps={navigation.steps} />}
    </div>
  );
}

function NavigationStepCard({ step, isLast }: { step: NavigationStep; isLast: boolean }) {
  return (
    <div>
      <div className="rounded-lg border border-[#232326] bg-[#111113] p-3.5">
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#1C1C20] font-mono text-[10px] text-[#EAE7E0]">
            {step.order}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-[#EAE7E0]">
              <FileCode2 className="h-3.5 w-3.5 text-[#726E67]" />
              <span>{step.filePath}</span>
              {step.symbol && (
                <>
                  <ChevronRight className="h-3 w-3 text-[#38373B]" />
                  <span className="text-[#9E9A92]">{step.symbol}</span>
                </>
              )}
            </div>
            <p className="mt-2 text-[12.5px] leading-5 text-[#9E9A92]">{step.explanation}</p>
          </div>
        </div>
      </div>
      {!isLast && <RelationshipConnector relationship={step.relationshipFromPrevious} />}
    </div>
  );
}

function RelationshipConnector({ relationship }: { relationship?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-3">
      <div className="h-3 w-px bg-[#232326]" />
      <span className="rounded border border-[#232326] bg-[#141417] px-2 py-0.5 font-mono text-[9.5px] text-[#726E67]">
        {relationship ?? "related"}
      </span>
    </div>
  );
}

function Branches({ branches }: { branches: NavigationBranch[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <SectionHeader icon={<GitBranch className="h-3.5 w-3.5" />} title={`Related paths (${branches.length})`} />
        {open ? <ArrowUp className="h-3.5 w-3.5 text-[#726E67]" /> : <ArrowDown className="h-3.5 w-3.5 text-[#726E67]" />}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2">
          {branches.map((branch, index) => (
            <div key={`${branch.filePath}-${index}`} className="rounded-lg border border-[#232326] bg-[#111113] p-3 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-[#EAE7E0]">
                <FileCode2 className="h-3.5 w-3.5 text-[#726E67]" />
                <span>{branch.filePath}</span>
              </div>
              {branch.explanation && <p className="mt-1 font-sans text-[12px] text-[#9E9A92]">{branch.explanation}</p>}
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
      <SectionHeader icon={<FileCode2 className="h-3.5 w-3.5" />} title="Sources" />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <div key={`${source.filePath}-${source.startLine}`} className="rounded border border-[#232326] bg-[#141417] px-2.5 py-1 font-mono text-[10px]">
            <span className="text-[#EAE7E0]">{source.filePath}</span>
            <span className="ml-1.5 text-[#726E67]">L{source.startLine}–{source.endLine}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#726E67]">
      {icon}
      <span>{title}</span>
    </div>
  );
}