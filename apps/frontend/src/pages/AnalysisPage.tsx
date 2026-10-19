import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

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

import {
  Brain,
  GripVertical,
  CheckCircle2,
  Terminal,
  ChevronRight,
  Lock,
} from "lucide-react";

type Tab = "overview" | "architecture" | "qa";

const DEFAULT_EXPLANATION_PANEL_WIDTH = 420;
const MIN_EXPLANATION_PANEL_WIDTH = 320;
const MAX_EXPLANATION_PANEL_WIDTH = 700;

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
.cn-root { font-family: 'Inter', system-ui, sans-serif; }
.cn-root .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.cn-root .font-display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; }
@keyframes cn-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.cn-rise { animation: cn-rise .55s cubic-bezier(.2,.7,.2,1) both; }
@keyframes cn-sheen { from { background-position: -200% 0; } to { background-position: 200% 0; } }
.cn-sheen { background: linear-gradient(90deg,#1B1B1E 30%,#26262A 50%,#1B1B1E 70%); background-size: 200% 100%; animation: cn-sheen 1.8s linear infinite; }
:where(.cn-root) button:focus-visible { outline: 2px solid #D4A359; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .cn-rise, .cn-sheen { animation: none; } }
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const stars = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.1 + 0.3,
      speedY: Math.random() * 0.08 + 0.02,
      opacity: Math.random() * 0.5 + 0.1,
      pulseSpeed: Math.random() * 0.01 + 0.002,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#0D0D0E");
      gradient.addColorStop(0.5, "#111113");
      gradient.addColorStop(1, "#09090A");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(234, 231, 224, 0.03)";
      for (let x = 0; x < width; x += 32) {
        for (let y = 0; y < height; y += 32) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      for (const star of stars) {
        star.y -= star.speedY;
        if (star.y < 0) star.y = height;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(234, 231, 224, ${star.opacity})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
  const isDone = analysisStatus === "completed";
  const maxScore =
    architectureMap?.type === "importance-ranked"
      ? Math.max(...architectureMap.rankedFiles.map((f) => f.importanceScore), 0.0001)
      : 1;

  return (
    <main className={`cn-root relative min-h-screen w-full overflow-hidden bg-[#0D0D0E] text-[#EAE7E0] selection:bg-[#D4A359]/25 ${isResizingExplanation ? "select-none" : ""}`}>
      <style>{STYLE}</style>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[360px] bg-[radial-gradient(ellipse_at_50%_-20%,rgba(212,163,89,0.08),transparent_70%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-[#232326] bg-[#0D0D0E]/75 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-6 px-6 py-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2B2B30] bg-gradient-to-b from-[#1C1C20] to-[#131316]">
                <Terminal className="h-4 w-4 text-[#D4A359]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-[#726E67]">
                  <span>analysis</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{jobId}</span>
                </div>
                <h1 className="truncate text-[15px] font-semibold tracking-tight">{repositoryLabel}</h1>
              </div>
            </div>

            {architectureMap && (
              <nav className="relative flex shrink-0 gap-0.5 rounded-xl border border-[#232326] bg-[#111113] p-1">
                {(["overview", "architecture", "qa"] as Tab[]).map((t) => {
                  const isQALocked = t === "qa" && !(capabilities.qa && capabilities.navigation);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !isQALocked && setTab(t)}
                      disabled={isQALocked}
                      className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12.5px] font-medium capitalize transition-colors duration-200 ${
                        tab === t
                          ? "bg-[#EAE7E0] text-[#0D0D0E] shadow-[0_1px_8px_rgba(234,231,224,0.15)]"
                          : isQALocked
                          ? "cursor-not-allowed text-[#4A4845]"
                          : "text-[#9E9A92] hover:text-[#EAE7E0]"
                      }`}
                    >
                      {isQALocked && <Lock className="h-3 w-3" />}
                      {t === "qa" ? (isQALocked ? "Q&A · locked" : "Q&A") : t}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Live progress hairline */}
          {architectureMap && isProcessing && (
            <div className="h-[2px] w-full bg-[#1A1A1D]">
              <div
                className="h-full bg-gradient-to-r from-[#9E9A92] to-[#D4A359] transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </header>

        {/* Status strip */}
        {architectureMap && (isProcessing || isDone) && (
          <div className="border-b border-[#1B1B1E] bg-[#0F0F11]/70 px-6 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-[12px]">
              {isProcessing ? (
                <>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4A359] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D4A359]" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[#9E9A92]">
                    {analysisPhase === "ai_preparation"
                      ? "AI knowledge preparation is running in the background."
                      : "Repository analysis is running."}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-[#D4A359]">{progress}%</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#D4A359]" />
                  <span className="font-mono text-[11.5px] text-[#9E9A92]">
                    AI indexation complete. Semantic code navigation unlocked.
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Viewport */}
        <div className={tab === "architecture" || tab === "qa" ? "w-full flex-1 p-3" : "mx-auto flex w-full max-w-[1100px] flex-1 px-6 py-12"}>
          {isLoading && (
            <div className="cn-rise mx-auto mt-[12vh] w-full max-w-[560px]">
              <p className="font-display text-[34px] leading-tight text-[#EAE7E0]">Mapping repository structure…</p>
              <p className="mt-2 text-[13px] text-[#726E67]">Reading files, grouping layers and tracing dependencies.</p>
              <div className="mt-8 space-y-3">
                <div className="cn-sheen h-3 w-full rounded-full" />
                <div className="cn-sheen h-3 w-[86%] rounded-full" />
                <div className="cn-sheen h-3 w-[64%] rounded-full" />
              </div>
            </div>
          )}

          {error && (
            <p className="cn-rise h-fit rounded-lg border border-[#D4A359]/30 bg-[#D4A359]/[0.06] px-4 py-3 font-mono text-[13px] text-[#EAE7E0]">
              {error}
            </p>
          )}

          {!isLoading && !error && architectureMap && (
            <>
              {/* Overview */}
              {tab === "overview" && (
                <div className="cn-rise w-full">
                  <p className="text-[12px] font-medium text-[#D4A359]">Executive summary</p>
                  <p className="font-display mt-4 max-w-[900px] text-[30px] leading-[1.25] text-[#EAE7E0] md:text-[38px]">
                    {architectureMap.summary}
                  </p>

                  <dl className="mt-12 grid grid-cols-3 divide-x divide-[#232326] border-y border-[#232326]">
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

                  <h2 className="mt-14 text-[13px] font-medium text-[#9E9A92]">
                    {architectureMap.type === "structured" ? "How the code is organized" : "Most important files"}
                  </h2>

                  {architectureMap.type === "structured" ? (
                    <ol className="mt-4 divide-y divide-[#1E1E21]">
                      {architectureMap.layers.map((layer) => {
                        const share = totalFiles ? (layer.files.length / totalFiles) * 100 : 0;
                        return (
                          <li key={layer.name} className="group grid gap-x-8 gap-y-2 py-5 transition-colors md:grid-cols-[220px_1fr_140px]">
                            <span className="text-[15px] font-semibold text-[#EAE7E0] transition-colors group-hover:text-[#D4A359]">
                              {layer.name}
                            </span>
                            <p className="text-[13.5px] leading-6 text-[#9E9A92]">{layer.description}</p>
                            <div className="flex flex-col items-start gap-2 md:items-end">
                              <span className="font-mono text-[11px] text-[#726E67]">
                                {layer.files.length} file{layer.files.length === 1 ? "" : "s"}
                              </span>
                              <div className="h-[3px] w-full max-w-[140px] overflow-hidden rounded-full bg-[#1E1E21]">
                                <div className="h-full rounded-full bg-[#D4A359]/80" style={{ width: `${Math.max(share, 3)}%` }} />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <ol className="mt-4 divide-y divide-[#1E1E21]">
                      {architectureMap.rankedFiles.map((file) => (
                        <li key={file.path} className="group grid gap-x-8 gap-y-2 py-5 md:grid-cols-[1fr_140px]">
                          <div className="min-w-0">
                            <span className="block truncate font-mono text-[12.5px] text-[#EAE7E0] transition-colors group-hover:text-[#D4A359]">
                              {file.path}
                            </span>
                            <p className="mt-1.5 text-[13.5px] leading-6 text-[#9E9A92]">{file.reason}</p>
                          </div>
                          <div className="flex flex-col items-start gap-2 md:items-end">
                            <span className="font-mono text-[12px] text-[#D4A359]">{file.importanceScore.toFixed(2)}</span>
                            <div className="h-[3px] w-full max-w-[140px] overflow-hidden rounded-full bg-[#1E1E21]">
                              <div className="h-full rounded-full bg-[#D4A359]/80" style={{ width: `${(file.importanceScore / maxScore) * 100}%` }} />
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
                  <aside className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-[#232326] bg-[#111113]/90 p-2.5">
                    {repositoryTree ? (
                      <RepositoryTree tree={repositoryTree} onSelectFile={handleFileSelect} />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[12px] text-[#726E67]">
                        Tree unavailable.
                      </div>
                    )}
                  </aside>

                  <div className="flex min-w-0 flex-1">
                    <div className={`min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#232326] bg-[#0E0E10] ${isExplanationOpen ? "rounded-r-none border-r-0" : ""}`}>
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
                          onMouseDown={handleResizeStart}
                          className="group relative flex w-2.5 shrink-0 cursor-col-resize items-center justify-center border-y border-[#232326] bg-[#141417] transition-colors hover:bg-[#D4A359]/20"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-[#726E67] group-hover:text-[#D4A359]" />
                        </div>

                        <div className="shrink-0 overflow-hidden rounded-r-2xl border border-l-0 border-[#232326] bg-[#121214]" style={{ width: `${explanationPanelWidth}px` }}>
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
                  <div className="cn-rise flex h-[calc(100vh-140px)] w-full items-center justify-center rounded-2xl border border-[#232326] bg-[#111113]/90">
                    <div className="max-w-md p-6 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#161619]">
                        <Brain className="h-5 w-5 animate-pulse text-[#D4A359]" />
                      </div>
                      <p className="font-display mt-5 text-[28px] text-[#EAE7E0]">Q&A engine initializing</p>
                      <p className="mt-2 text-[13px] leading-5 text-[#9E9A92]">Semantic graph mappings are currently processing. Check back in a moment.</p>
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
      <dt className="text-[12px] text-[#726E67]">{label}</dt>
      <dd className="font-display mt-1 text-[48px] leading-none text-[#EAE7E0]">{value}</dd>
    </div>
  );
}