import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useParams,
} from "react-router-dom";

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

import {
  explainFile,
  type FileExplanation,
} from "../lib/explainer.api";

import RepositoryTree from "../components/RepositoryTree";
import ExplanationPanel from "../components/ExplanationPanel";
import QAChat from "../components/QAChat";

import {
  Brain,
  GripVertical,
  PanelRightClose,
  Sparkles,
  CheckCircle2,
  Terminal,
} from "lucide-react";

type Tab =
  | "overview"
  | "architecture"
  | "qa";

interface Comet {
  x: number;
  y: number;
  length: number;
  speedX: number;
  speedY: number;
  size: number;
  opacity: number;
}

const DEFAULT_EXPLANATION_PANEL_WIDTH = 420;
const MIN_EXPLANATION_PANEL_WIDTH = 320;
const MAX_EXPLANATION_PANEL_WIDTH = 700;

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

      // Warm vintage dark background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#0D0D0E");
      gradient.addColorStop(0.5, "#111113");
      gradient.addColorStop(1, "#09090A");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle vintage background grid line dots
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

  return (
    <main className={`relative min-h-screen w-full overflow-hidden bg-[#0D0D0E] text-[#EAE7E0] selection:bg-[#EAE7E0]/20 font-sans ${isResizingExplanation ? "select-none" : ""}`}>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Vintage Instrument Top Navigation Header */}
        <header className="border-b border-[#232326] bg-[#0F0F12]/80 px-6 py-3.5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#161619] shadow-inner">
                <Terminal className="h-4 w-4 text-[#9E9A92]" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-wider uppercase text-[#726E67]">
                  analysis // {jobId}
                </p>
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-[#EAE7E0]">
                  {repositoryLabel}
                </h1>
              </div>
            </div>

            {architectureMap && (
              <nav className="flex shrink-0 gap-1 rounded-lg border border-[#232326] bg-[#141417] p-1 shadow-sm">
                {(["overview", "architecture", "qa"] as Tab[]).map((t) => {
                  const isQALocked = t === "qa" && !(capabilities.qa && capabilities.navigation);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !isQALocked && setTab(t)}
                      disabled={isQALocked}
                      className={`rounded-md px-3.5 py-1.5 text-[12px] font-medium capitalize transition-all duration-200 ${
                        tab === t
                          ? "border border-[#38373B] bg-[#222226] text-[#EAE7E0] shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                          : isQALocked
                          ? "cursor-not-allowed text-[#454340]"
                          : "border border-transparent text-[#9E9A92] hover:text-[#EAE7E0]"
                      }`}
                    >
                      {t === "qa" ? (isQALocked ? "Q&A · locked" : "Q&A") : t}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </header>

        {/* Processing Banner */}
        {architectureMap && analysisStatus === "processing" && (
          <div className="border-b border-[#232326] bg-[#141417]/80 px-6 py-2.5 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1400px] items-center gap-3">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#D4A359]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <p className="truncate text-[12px] text-[#9E9A92]">
                    {analysisPhase === "ai_preparation"
                      ? "AI knowledge preparation is running in the background."
                      : "Repository analysis is running."}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-[#726E67]">
                    {Math.min(100, Math.max(0, analysisProgress))}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#1F1F22]">
                  <div
                    className="h-full rounded-full bg-[#9E9A92] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, analysisProgress))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion Indicator */}
        {architectureMap && analysisStatus === "completed" && (
          <div className="border-b border-[#232326] bg-[#121215]/50 px-6 py-1.5">
            <div className="mx-auto flex max-w-[1400px] items-center gap-2 text-[11px] font-mono text-[#9E9A92]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#EAE7E0]" />
              <span>AI indexation complete. Semantic code navigation unlocked.</span>
            </div>
          </div>
        )}

        {/* Viewport Container */}
        <div className={tab === "architecture" || tab === "qa" ? "w-full flex-1 p-3" : "mx-auto flex w-full max-w-[1200px] flex-1 px-6 py-8"}>
          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#232326] border-t-[#EAE7E0]" />
                <p className="mt-4 font-mono text-[12px] uppercase tracking-wider text-[#9E9A92]">Mapping repository structure…</p>
              </div>
            </div>
          )}

          {error && (
            <p className="border-l-2 border-[#D4A359] pl-3 font-mono text-[13px] text-[#EAE7E0]">
              {error}
            </p>
          )}

          {!isLoading && !error && architectureMap && (
            <>
              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="max-w-[800px] space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <StatChip label="Structure" value={architectureMap.type === "structured" ? "Clear" : "Loose"} />
                    <StatChip label={architectureMap.type === "structured" ? "Layers" : "Ranked files"} value={architectureMap.type === "structured" ? architectureMap.layers.length : architectureMap.rankedFiles.length} />
                    <StatChip label="Files" value={totalFiles} />
                  </div>

                  <div className="rounded-xl border border-[#232326] bg-[#141417] p-6 shadow-sm">
                    <h2 className="font-mono text-[11px] uppercase tracking-widest text-[#726E67]">Executive Summary</h2>
                    <p className="mt-3 text-[14px] leading-7 text-[#C2C0B8]">
                      {architectureMap.summary}
                    </p>
                  </div>

                  {architectureMap.type === "structured" ? (
                    <div className="space-y-3">
                      {architectureMap.layers.map((layer) => (
                        <div key={layer.name} className="rounded-xl border border-[#232326] bg-[#141417] p-4 transition-all duration-200 hover:border-[#38373B]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[14px] font-semibold text-[#EAE7E0]">{layer.name}</span>
                            <span className="shrink-0 rounded-full border border-[#2B2B30] bg-[#1B1B1E] px-2.5 py-0.5 font-mono text-[10px] text-[#9E9A92]">
                              {layer.files.length} file{layer.files.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="mt-2 text-[13px] leading-6 text-[#9E9A92]">{layer.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {architectureMap.rankedFiles.map((file) => (
                        <div key={file.path} className="rounded-xl border border-[#232326] bg-[#141417] p-4 transition-all duration-200 hover:border-[#38373B]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-mono text-[12px] text-[#EAE7E0]">{file.path}</span>
                            <span className="shrink-0 font-mono text-[11px] text-[#D4A359]">{file.importanceScore.toFixed(2)}</span>
                          </div>
                          <p className="mt-2 text-[13px] leading-6 text-[#9E9A92]">{file.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Architecture Tab */}
              {tab === "architecture" && (
                <div className="flex h-[calc(100vh-125px)] w-full gap-3">
                  <div className="w-[300px] shrink-0 overflow-hidden rounded-xl border border-[#232326] bg-[#141417] p-2.5">
                    {repositoryTree ? (
                      <RepositoryTree tree={repositoryTree} onSelectFile={handleFileSelect} />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[12px] text-[#726E67]">
                        Tree unavailable.
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1">
                    <div className={`min-w-0 flex-1 overflow-hidden rounded-xl border border-[#232326] bg-[#111113] ${isExplanationOpen ? "rounded-r-none border-r-0" : ""}`}>
                      {isFileLoading ? (
                        <div className="flex h-full items-center justify-center">
                          <p className="font-mono text-[12px] text-[#726E67]">Loading source document...</p>
                        </div>
                      ) : selectedFile ? (
                        <div className="flex h-full flex-col">
                          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#232326] bg-[#141417] px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] text-[#726E67]">FILE PATH</p>
                              <p className="truncate font-mono text-[12px] text-[#EAE7E0]" title={selectedFile.path}>
                                {selectedFile.path}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleExplanationToggle}
                              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all duration-200 ${
                                isExplanationOpen
                                  ? "border-[#38373B] bg-[#222226] text-[#EAE7E0]"
                                  : "border-[#232326] bg-[#18181B] text-[#9E9A92] hover:border-[#38373B] hover:text-[#EAE7E0]"
                              }`}
                            >
                              {isExplanationOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5 text-[#9E9A92]" />}
                              <span>{isExplanationOpen ? "Hide AI" : "Explain file"}</span>
                            </button>
                          </div>

                          <div className="custom-scrollbar flex-1 overflow-auto bg-[#0E0E10]">
                            <pre className="min-h-full p-4 font-mono text-[12px] leading-6 text-[#C2C0B8]">
                              <code>{selectedFile.content}</code>
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                          <p className="font-mono text-[12px] text-[#726E67]">SELECT A FILE</p>
                          <p className="mt-1 text-[13px] text-[#9E9A92]">Pick a file from the code tree to preview source & insights.</p>
                        </div>
                      )}
                    </div>

                    {isExplanationOpen && (
                      <>
                        <div
                          role="separator"
                          onMouseDown={handleResizeStart}
                          className="group relative flex w-2.5 shrink-0 cursor-col-resize items-center justify-center border-y border-[#232326] bg-[#141417] hover:bg-[#222226]"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-[#726E67] group-hover:text-[#EAE7E0]" />
                        </div>

                        <div className="shrink-0 overflow-hidden rounded-r-xl border border-[#232326] border-l-0 bg-[#141417]" style={{ width: `${explanationPanelWidth}px` }}>
                          <ExplanationPanel explanation={fileExplanation} isLoading={isExplanationLoading} error={explanationError} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Q&A Tab */}
              {tab === "qa" && (
                capabilities.qa && capabilities.navigation ? (
                  <QAChat repositoryId={jobId ?? ""} repositoryTree={repositoryTree} onSelectFile={handleFileSelect} />
                ) : (
                  <div className="flex h-[calc(100vh-140px)] items-center justify-center rounded-xl border border-[#232326] bg-[#141417]">
                    <div className="max-w-md p-6 text-center">
                      <Brain className="mx-auto h-6 w-6 text-[#9E9A92]" />
                      <p className="mt-3 text-[14px] font-semibold text-[#EAE7E0]">Q&A engine initializing</p>
                      <p className="mt-1.5 text-[12px] leading-5 text-[#9E9A92]">Semantic graph mappings are currently processing. Check back in a moment.</p>
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

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#232326] bg-[#141417] px-4 py-2.5 backdrop-blur-md">
      <p className="font-mono text-[9px] uppercase tracking-wider text-[#726E67]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-[#EAE7E0]">{value}</p>
    </div>
  );
}