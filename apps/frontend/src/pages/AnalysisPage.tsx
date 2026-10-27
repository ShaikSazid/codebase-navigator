import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  getRepositoryStatus,
  getRepositoryFile,
  type RepositoryAnalysisStatus,
  type ArchitectureMap,
  type RepositoryTreeNode,
  type RepositoryFile,
  type RepositoryCapabilities,
  type RepositoryAnalysisPhase,
  type RepositoryPhaseStatus,
} from "../lib/repository.api";

import { explainFile, type FileExplanation } from "../lib/explainer.api";

import RepositoryTree from "../components/RepositoryTree";
import ExplanationPanel from "../components/ExplanationPanel";
import QAChat from "../components/QAChat";
import SourceViewer from "../components/Sourceviewer";

import { Brain, GripVertical, Terminal, ChevronRight, Lock } from "lucide-react";

/* Palette (shared with the landing page):
   #F2E9E4 cream (page), #22223B indigo (ink, code window, primary buttons), #4A4E69 slate (lines, muted text). */

type Tab = "overview" | "architecture" | "qa";

const DEFAULT_EXPLANATION_PANEL_WIDTH = 420;
const MIN_EXPLANATION_PANEL_WIDTH = 320;
const MAX_EXPLANATION_PANEL_WIDTH = 700;

/* Fonts are loaded from <link> tags in index.html (Syne, DM Sans, JetBrains Mono).
   The classes below are shared by the child components (font-display, font-mono, cn-rise, cn-sheen, cn-sheen-dark, custom-scrollbar, cn-dark). */
const STYLE = `
.cn-root { font-family: 'DM Sans', system-ui, sans-serif; }
.cn-root .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.cn-root .font-display { font-family: 'Syne', 'Trebuchet MS', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.02em; }

@keyframes cn-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.cn-rise { animation: cn-rise .55s cubic-bezier(.2,.7,.2,1) both; }

@keyframes cn-sheen { from { background-position: -200% 0; } to { background-position: 200% 0; } }
.cn-sheen { background: linear-gradient(90deg,#E4D8D1 30%,#EEE3DD 50%,#E4D8D1 70%); background-size: 200% 100%; animation: cn-sheen 1.8s linear infinite; }
.cn-sheen-dark { background: linear-gradient(90deg,#2C2C47 30%,#3A3A5A 50%,#2C2C47 70%); background-size: 200% 100%; animation: cn-sheen 1.8s linear infinite; }

.cn-root .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #4A4E69 transparent; }
.cn-root .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.cn-root .custom-scrollbar::-webkit-scrollbar-thumb { background: #4A4E69; border-radius: 9999px; }
.cn-root .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }

:where(.cn-root) :is(button, a):focus-visible { outline: 2px solid #22223B; outline-offset: 2px; }
.cn-dark :is(button, a):focus-visible { outline-color: #F2E9E4; }

@media (prefers-reduced-motion: reduce) { .cn-rise, .cn-sheen, .cn-sheen-dark { animation: none; } }
`;

export default function AnalysisPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();

  const repositoryUrl =
    (location.state as { repositoryUrl?: string } | null)?.repositoryUrl ??
    "Unknown repository";

  const repositoryLabel = repositoryUrl
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");

  const [architectureMap, setArchitectureMap] = useState<ArchitectureMap | null>(null);
  const [repositoryTree, setRepositoryTree] = useState<RepositoryTreeNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<RepositoryFile | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileExplanation, setFileExplanation] = useState<FileExplanation | null>(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [explanationPanelWidth, setExplanationPanelWidth] = useState(DEFAULT_EXPLANATION_PANEL_WIDTH);
  const [isResizingExplanation, setIsResizingExplanation] = useState(false);

  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_EXPLANATION_PANEL_WIDTH);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [analysisStatus, setAnalysisStatus] = useState<RepositoryAnalysisStatus | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<RepositoryAnalysisPhase | null>(null);
  const [, setPhaseStatus] = useState<RepositoryPhaseStatus | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const [capabilities, setCapabilities] = useState<RepositoryCapabilities>({
    overview: false,
    architecture: false,
    source: false,
    qa: false,
    navigation: false,
  });

  useEffect(() => {
    if (!jobId) {
      setError("Analysis ID is missing.");
      setIsLoading(false);
      return;
    }

    const analysisJobId = jobId;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function pollAnalysisStatus() {
      try {
        const job = await getRepositoryStatus(analysisJobId);
        if (cancelled) return;

        setAnalysisStatus(job.status);
        setAnalysisPhase(job.phase ?? null);
        setPhaseStatus(job.phaseStatus ?? null);
        setAnalysisProgress(job.progress ?? 0);

        if (job.capabilities) setCapabilities(job.capabilities);

        const phaseOneReady = Boolean(
          job.capabilities?.overview &&
            job.capabilities?.architecture &&
            job.capabilities?.source,
        );

        if (phaseOneReady) {
          if (job.architectureMap) setArchitectureMap(job.architectureMap);
          if (job.repositoryTree) setRepositoryTree(job.repositoryTree);
          setIsLoading(false);
        }

        if (job.status === "failed") {
          setError("Repository analysis failed.");
          setIsLoading(false);
          return;
        }

        if (job.status === "completed") {
          if (!phaseOneReady && job.architectureMap) setArchitectureMap(job.architectureMap);
          if (!phaseOneReady && job.repositoryTree) setRepositoryTree(job.repositoryTree);
          setIsLoading(false);
          return;
        }

        timeoutId = setTimeout(pollAnalysisStatus, 1500);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setError("Unable to check repository analysis status.");
        setIsLoading(false);
      }
    }

    void pollAnalysisStatus();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobId]);

  const handleResizeMove = useCallback((event: MouseEvent) => {
    const delta = resizeStartXRef.current - event.clientX;
    const nextWidth = Math.min(
      MAX_EXPLANATION_PANEL_WIDTH,
      Math.max(MIN_EXPLANATION_PANEL_WIDTH, resizeStartWidthRef.current + delta),
    );
    setExplanationPanelWidth(nextWidth);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizingExplanation(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = explanationPanelWidth;
    setIsResizingExplanation(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  }, [explanationPanelWidth, handleResizeMove, handleResizeEnd]);

  const buildRepositoryContext = useCallback((path: string) => {
    if (architectureMap?.type === "structured") {
      const matchingLayers = architectureMap.layers.filter((layer) =>
        layer.files.includes(path),
      );
      if (matchingLayers.length > 0) {
        return [
          `Repository summary: ${architectureMap.summary}`,
          "",
          matchingLayers
            .map((layer) => `Layer: ${layer.name}\nDescription: ${layer.description}`)
            .join("\n\n"),
        ].join("\n");
      }
      return `Repository summary: ${architectureMap.summary}`;
    }
    if (architectureMap?.type === "importance-ranked") {
      const rankedFile = architectureMap.rankedFiles.find((ranked) => ranked.path === path);
      return [
        `Repository summary: ${architectureMap.summary}`,
        rankedFile
          ? `File importance score: ${rankedFile.importanceScore}\nReason: ${rankedFile.reason}`
          : "No ranking information is available for this file.",
      ].join("\n\n");
    }
    return "No additional repository context provided.";
  }, [architectureMap]);

  const handleFileSelect = useCallback(async (path: string, node: RepositoryTreeNode) => {
    if (node.type !== "file" || !jobId) return;
    try {
      setIsFileLoading(true);
      setSelectedFile(null);
      setFileExplanation(null);
      setExplanationError(null);
      const file = await getRepositoryFile(jobId, path);
      setSelectedFile(file);
    } catch (error) {
      console.error("Unable to load repository file", error);
      setExplanationError("Unable to load this file.");
    } finally {
      setIsFileLoading(false);
    }
  }, [jobId]);

  const handleExplainFile = useCallback(async () => {
    if (!selectedFile || !jobId) return;
    setIsExplanationOpen(true);
    if (fileExplanation) return;

    try {
      setIsExplanationLoading(true);
      setExplanationError(null);
      const repositoryContext = buildRepositoryContext(selectedFile.path);
      const explanation = await explainFile({
        repositoryId: jobId,
        filePath: selectedFile.path,
        content: selectedFile.content,
        repositoryContext,
      });
      setFileExplanation(explanation);
    } catch (error) {
      console.error("Unable to explain repository file", error);
      setExplanationError("Unable to generate an explanation for this file.");
    } finally {
      setIsExplanationLoading(false);
    }
  }, [selectedFile, fileExplanation, buildRepositoryContext, jobId]);

  const handleExplanationToggle = useCallback(() => {
    if (isExplanationOpen) {
      setIsExplanationOpen(false);
      return;
    }
    void handleExplainFile();
  }, [isExplanationOpen, handleExplainFile]);

  const totalFiles =
    architectureMap?.type === "structured"
      ? architectureMap.layers.reduce((sum, layer) => sum + layer.files.length, 0)
      : architectureMap?.type === "importance-ranked"
      ? architectureMap.rankedFiles.length
      : 0;

  const progress = Math.min(100, Math.max(0, analysisProgress));
  const isProcessing = analysisStatus === "processing";
  const maxScore =
    architectureMap?.type === "importance-ranked"
      ? Math.max(...architectureMap.rankedFiles.map((f) => f.importanceScore), 0.0001)
      : 1;

  return (
    <main
      className={`cn-root relative min-h-screen w-full overflow-x-clip bg-[#F2E9E4] text-[#22223B] selection:bg-[#22223B] selection:text-[#F2E9E4] ${
        isResizingExplanation ? "select-none" : ""
      }`}
    >
      <style>{STYLE}</style>

      {/* Blueprint dots, same as the landing page */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(34,34,59,0.12) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-[#4A4E69]/25 bg-[#F2E9E4]/85 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-6 px-6 py-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <Link
                to="/"
                aria-label="Analyze another repository"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#22223B] transition-colors hover:bg-[#4A4E69]"
              >
                <Terminal className="h-4 w-4 text-[#F2E9E4]" />
              </Link>
              <div className="min-w-0">
                {/* <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-[#5F6380]">
                  <span>analysis</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{jobId}</span>
                </div> */}
                <h1 className="font-display truncate text-[16px] leading-tight">{repositoryLabel}</h1>
              </div>
            </div>

            {architectureMap && (
              <nav className="relative flex shrink-0 gap-0.5 rounded-full border border-[#4A4E69]/30 bg-white/40 p-1" aria-label="Sections">
                {(["overview", "architecture", "qa"] as Tab[]).map((t) => {
                  const isQALocked = t === "qa" && !(capabilities.qa && capabilities.navigation);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !isQALocked && setTab(t)}
                      disabled={isQALocked}
                      aria-current={tab === t ? "page" : undefined}
                      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition-colors duration-200 ${
                        tab === t
                          ? "bg-[#22223B] text-[#F2E9E4]"
                          : isQALocked
                          ? "cursor-not-allowed text-[#6B6F88]"
                          : "text-[#4A4E69] hover:text-[#22223B]"
                      }`}
                    >
                      {isQALocked && <Lock className="h-3 w-3" />}
                      {t === "qa" ? (isQALocked ? "Q&A (preparing)" : "Q&A") : t}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Live progress hairline */}
          {architectureMap && isProcessing && (
            <div className="h-[2px] w-full bg-[#4A4E69]/15">
              <div className="h-full bg-[#22223B] transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          )}
        </header>

        {/* Status strip */}
        {architectureMap && isProcessing && (
          <div className="border-b border-[#4A4E69]/15 bg-white/40 px-6 py-2 backdrop-blur-md" aria-live="polite">
            <div className="flex items-center gap-2.5 text-[12.5px]">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22223B] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22223B]" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[#4A4E69]">
                {analysisPhase === "ai_preparation"
                  ? "Preparing AI knowledge in the background. Q&A unlocks when it finishes."
                  : "Analyzing the repository."}
              </p>
              <span className="shrink-0 font-mono text-[11px] text-[#22223B]">{progress}%</span>
            </div>
          </div>
        )}

        {/* Viewport */}
        <div className={tab === "architecture" || tab === "qa" ? "w-full flex-1 p-3" : "mx-auto flex w-full max-w-[1100px] flex-1 px-6 py-12"}>
          {isLoading && (
            <div className="cn-rise mx-auto mt-[12vh] w-full max-w-[560px]">
              <p className="font-display text-[32px] leading-tight">Mapping repository structure…</p>
              <p className="mt-2 text-[14px] text-[#4A4E69]">Reading files, grouping layers and tracing dependencies.</p>
              <div className="mt-8 space-y-3">
                <div className="cn-sheen h-3 w-full rounded-full" />
                <div className="cn-sheen h-3 w-[86%] rounded-full" />
                <div className="cn-sheen h-3 w-[64%] rounded-full" />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="cn-rise h-fit rounded-xl border border-[#22223B]/30 bg-white/60 px-4 py-3 font-mono text-[13px] text-[#22223B]">
              {error}
            </p>
          )}

          {!isLoading && !error && architectureMap && (
            <>
              {/* Overview */}
              {tab === "overview" && (
                <div className="cn-rise w-full">
                  <p className="max-w-[860px] text-[22px] font-medium leading-[1.35] tracking-tight md:text-[30px]">
                    {architectureMap.summary}
                  </p>

                  <dl className="mt-12 grid grid-cols-3 divide-x divide-[#4A4E69]/25 border-y border-[#4A4E69]/25">
                    {[
                      { label: "Structure", value: architectureMap.type === "structured" ? "Clear" : "Loose" },
                      {
                        label: architectureMap.type === "structured" ? "Layers" : "Ranked files",
                        value: architectureMap.type === "structured" ? architectureMap.layers.length : architectureMap.rankedFiles.length,
                      },
                      { label: "Files", value: totalFiles },
                    ].map((s) => (
                      <StatBlock key={s.label} label={s.label} value={s.value} />
                    ))}
                  </dl>

                  <h2 className="font-display mt-14 text-[22px]">
                    {architectureMap.type === "structured" ? "How the code is organized" : "Most important files"}
                  </h2>

                  {architectureMap.type === "structured" ? (
                    <ol className="mt-4 divide-y divide-[#4A4E69]/20">
                      {architectureMap.layers.map((layer) => {
                        const share = totalFiles ? (layer.files.length / totalFiles) * 100 : 0;
                        return (
                          <li key={layer.name} className="grid gap-x-8 gap-y-2 py-5 md:grid-cols-[220px_1fr_140px]">
                            <span className="text-[15px] font-bold">{layer.name}</span>
                            <p className="text-[14px] leading-6 text-[#4A4E69]">{layer.description}</p>
                            <div className="flex flex-col items-start gap-2 md:items-end">
                              <span className="font-mono text-[11px] text-[#5F6380]">
                                {layer.files.length} file{layer.files.length === 1 ? "" : "s"}
                              </span>
                              <div className="h-[3px] w-full max-w-[140px] overflow-hidden rounded-full bg-[#4A4E69]/20">
                                <div className="h-full rounded-full bg-[#22223B]" style={{ width: `${Math.max(share, 3)}%` }} />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <ol className="mt-4 divide-y divide-[#4A4E69]/20">
                      {architectureMap.rankedFiles.map((file) => (
                        <li key={file.path} className="grid gap-x-8 gap-y-2 py-5 md:grid-cols-[1fr_140px]">
                          <div className="min-w-0">
                            <span className="block truncate font-mono text-[12.5px] font-medium">{file.path}</span>
                            <p className="mt-1.5 text-[14px] leading-6 text-[#4A4E69]">{file.reason}</p>
                          </div>
                          <div className="flex flex-col items-start gap-2 md:items-end">
                            <span className="font-mono text-[12px]">{file.importanceScore.toFixed(2)}</span>
                            <div className="h-[3px] w-full max-w-[140px] overflow-hidden rounded-full bg-[#4A4E69]/20">
                              <div className="h-full rounded-full bg-[#22223B]" style={{ width: `${(file.importanceScore / maxScore) * 100}%` }} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Architecture */}
              {tab === "architecture" && (
                <div className="cn-rise flex h-[calc(100vh-125px)] w-full gap-3">
                  <aside className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-[#4A4E69]/25 bg-white/50 p-2.5">
                    {repositoryTree ? (
                      <RepositoryTree tree={repositoryTree} onSelectFile={handleFileSelect} />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[12px] text-[#5F6380]">
                        File tree unavailable.
                      </div>
                    )}
                  </aside>

                  <div className="flex min-w-0 flex-1">
                    <div className={`min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#22223B] bg-[#22223B] ${isExplanationOpen ? "rounded-r-none border-r-0" : ""}`}>
                      <SourceViewer
                        file={selectedFile}
                        isLoading={isFileLoading}
                        isExplanationOpen={isExplanationOpen}
                        onToggleExplanation={handleExplanationToggle}
                      />
                    </div>

                    {isExplanationOpen && (
                      <>
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Resize explanation panel"
                          onMouseDown={handleResizeStart}
                          className="group relative flex w-2.5 shrink-0 cursor-col-resize items-center justify-center border-y border-[#4A4E69]/25 bg-white/70 transition-colors hover:bg-[#22223B]/10"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-[#5F6380] group-hover:text-[#22223B]" />
                        </div>

                        <div className="shrink-0 overflow-hidden rounded-r-2xl border border-l-0 border-[#4A4E69]/25 bg-[#FBF6F3]" style={{ width: `${explanationPanelWidth}px` }}>
                          <ExplanationPanel explanation={fileExplanation} isLoading={isExplanationLoading} error={explanationError} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Q&A */}
              {tab === "qa" && (
                capabilities.qa && capabilities.navigation ? (
                  <QAChat repositoryId={jobId ?? ""} repositoryTree={repositoryTree} onSelectFile={handleFileSelect} />
                ) : (
                  <div className="cn-rise flex h-[calc(100vh-140px)] w-full items-center justify-center rounded-2xl border border-[#4A4E69]/25 bg-white/50">
                    <div className="max-w-md p-6 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#22223B]">
                        <Brain className="h-5 w-5 animate-pulse text-[#F2E9E4]" />
                      </div>
                      <p className="font-display mt-5 text-[26px]">Q&A is getting ready</p>
                      <p className="mt-2 text-[14px] leading-6 text-[#4A4E69]">
                        The repository is still being indexed for questions. This tab unlocks automatically when it finishes.
                      </p>
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-6 py-6 first:pl-0">
      <dt className="text-[13px] text-[#4A4E69]">{label}</dt>
      <dd className="font-display mt-1 text-[48px] leading-none">{value}</dd>
    </div>
  );
}