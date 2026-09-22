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
  type ArchitectureMap,
  type RepositoryTreeNode,
  type RepositoryFile,
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

interface Galaxy {
  x: number;
  y: number;
  radius: number;
  angle: number;
  rotationSpeed: number;
  opacity: number;
  fadeState:
    | "fadeIn"
    | "active"
    | "fadeOut";
  color: string;
}

const DEFAULT_EXPLANATION_PANEL_WIDTH = 420;
const MIN_EXPLANATION_PANEL_WIDTH = 320;
const MAX_EXPLANATION_PANEL_WIDTH = 700;

export default function AnalysisPage() {
  const { jobId } =
    useParams<{ jobId: string }>();

  const location = useLocation();

  const repositoryUrl =
    (
      location.state as {
        repositoryUrl?: string;
      } | null
    )?.repositoryUrl ??
    "Unknown repository";

  const repositoryLabel =
    repositoryUrl
      .replace(/^https?:\/\//, "")
      .replace(/\.git$/, "");

  const [
    architectureMap,
    setArchitectureMap,
  ] = useState<ArchitectureMap | null>(
    null,
  );

  const [
    repositoryTree,
    setRepositoryTree,
  ] = useState<RepositoryTreeNode | null>(
    null,
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<RepositoryFile | null>(
    null,
  );

  const [
    isFileLoading,
    setIsFileLoading,
  ] = useState(false);

  const [
    fileExplanation,
    setFileExplanation,
  ] = useState<FileExplanation | null>(
    null,
  );

  const [
    isExplanationLoading,
    setIsExplanationLoading,
  ] = useState(false);

  const [
    explanationError,
    setExplanationError,
  ] = useState<string | null>(null);

  const [
    isExplanationOpen,
    setIsExplanationOpen,
  ] = useState(false);

  const [
    explanationPanelWidth,
    setExplanationPanelWidth,
  ] = useState(
    DEFAULT_EXPLANATION_PANEL_WIDTH,
  );

  const [
    isResizingExplanation,
    setIsResizingExplanation,
  ] = useState(false);

  const resizeStartXRef =
    useRef(0);

  const resizeStartWidthRef =
    useRef(
      DEFAULT_EXPLANATION_PANEL_WIDTH,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [tab, setTab] =
    useState<Tab>("overview");

  /* ------------------------------------------------------------------------ */
  /* Dynamic Minimal Starfield & Rare Cosmic Events                          */
  /* ------------------------------------------------------------------------ */

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    let animationFrameId: number;

    let width =
      (canvas.width =
        window.innerWidth);

    let height =
      (canvas.height =
        window.innerHeight);

    const handleResize = () => {
      width =
        canvas.width =
          window.innerWidth;

      height =
        canvas.height =
          window.innerHeight;
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    const numStars = 25;

    const stars = Array.from(
      {
        length: numStars,
      },
      () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size:
          Math.random() * 1.2 + 0.3,
        speedY:
          Math.random() * 0.12 + 0.02,
        speedX:
          (Math.random() - 0.5) * 0.04,
        opacity:
          Math.random() * 0.6 + 0.15,
        pulseSpeed:
          Math.random() * 0.015 + 0.003,
      }),
    );

    let activeComet:
      | Comet
      | null = null;

    let activeGalaxy:
      | Galaxy
      | null = null;

    const spawnComet = () => {
      const side =
        Math.floor(
          Math.random() * 4,
        );

      let startX = 0;
      let startY = 0;
      let vx = 0;
      let vy = 0;

      if (side === 0) {
        startX =
          Math.random() * width;

        startY = -50;

        vx =
          (Math.random() - 0.5) * 6;

        vy =
          Math.random() * 4 + 4;
      } else if (side === 1) {
        startX =
          width + 50;

        startY =
          Math.random() * height;

        vx =
          -(Math.random() * 4 + 4);

        vy =
          (Math.random() - 0.5) * 6;
      } else if (side === 2) {
        startX =
          Math.random() * width;

        startY =
          height + 50;

        vx =
          (Math.random() - 0.5) * 6;

        vy =
          -(Math.random() * 4 + 4);
      } else {
        startX = -50;

        startY =
          Math.random() * height;

        vx =
          Math.random() * 4 + 4;

        vy =
          (Math.random() - 0.5) * 6;
      }

      activeComet = {
        x: startX,
        y: startY,
        length:
          Math.random() * 80 + 70,
        speedX: vx,
        speedY: vy,
        size:
          Math.random() * 1.5 + 1.5,
        opacity: 1,
      };
    };

    const spawnGalaxy = () => {
      const colors = [
        "#818cf8",
        "#c084fc",
        "#38bdf8",
        "#f472b6",
      ];

      activeGalaxy = {
        x:
          Math.random() *
            (width * 0.6) +
          width * 0.2,

        y:
          Math.random() *
            (height * 0.6) +
          height * 0.2,

        radius:
          Math.random() * 100 + 120,

        angle: 0,

        rotationSpeed: 0.002,

        opacity: 0,

        fadeState: "fadeIn",

        color:
          colors[
            Math.floor(
              Math.random() *
                colors.length,
            )
          ],
      };
    };

    const eventInterval =
      setInterval(() => {
        if (Math.random() > 0.4) {
          spawnComet();
        } else {
          spawnGalaxy();
        }
      }, 75000);

    const render = () => {
      ctx.clearRect(
        0,
        0,
        width,
        height,
      );

      const spaceGradient =
        ctx.createLinearGradient(
          0,
          0,
          0,
          height,
        );

      spaceGradient.addColorStop(
        0,
        "#05060A",
      );

      spaceGradient.addColorStop(
        0.5,
        "#080911",
      );

      spaceGradient.addColorStop(
        1,
        "#040508",
      );

      ctx.fillStyle =
        spaceGradient;

      ctx.fillRect(
        0,
        0,
        width,
        height,
      );

      for (const star of stars) {
        star.y -= star.speedY;

        star.x += star.speedX;

        star.opacity +=
          Math.sin(
            Date.now() *
              star.pulseSpeed,
          ) * 0.005;

        if (star.y < 0) {
          star.y = height;

          star.x =
            Math.random() * width;
        }

        if (star.x < 0) {
          star.x = width;
        }

        if (star.x > width) {
          star.x = 0;
        }

        ctx.beginPath();

        ctx.arc(
          star.x,
          star.y,
          star.size,
          0,
          Math.PI * 2,
        );

        ctx.fillStyle = `rgba(215, 225, 255, ${Math.max(
          0.1,
          Math.min(
            0.75,
            star.opacity,
          ),
        )})`;

        ctx.fill();
      }

      if (activeGalaxy) {
        const g =
          activeGalaxy;

        if (
          g.fadeState ===
          "fadeIn"
        ) {
          g.opacity += 0.003;

          if (g.opacity >= 0.35) {
            g.fadeState =
              "active";
          }
        } else if (
          g.fadeState ===
          "active"
        ) {
          g.angle +=
            g.rotationSpeed;

          if (
            Math.random() <
            0.002
          ) {
            g.fadeState =
              "fadeOut";
          }
        } else {
          g.opacity -= 0.002;

          if (g.opacity <= 0) {
            activeGalaxy = null;
          }
        }

        if (activeGalaxy) {
          ctx.save();

          ctx.translate(
            g.x,
            g.y,
          );

          ctx.rotate(
            g.angle,
          );

          const galaxyGradient =
            ctx.createRadialGradient(
              0,
              0,
              0,
              0,
              0,
              g.radius,
            );

          galaxyGradient.addColorStop(
            0,
            g.color,
          );

          galaxyGradient.addColorStop(
            0.4,
            "rgba(99, 102, 241, 0.15)",
          );

          galaxyGradient.addColorStop(
            1,
            "transparent",
          );

          ctx.fillStyle =
            galaxyGradient;

          ctx.globalAlpha =
            g.opacity;

          ctx.beginPath();

          ctx.ellipse(
            0,
            0,
            g.radius,
            g.radius * 0.4,
            0,
            0,
            Math.PI * 2,
          );

          ctx.fill();

          ctx.restore();
        }
      }

      if (activeComet) {
        const c =
          activeComet;

        c.x += c.speedX;
        c.y += c.speedY;

        const magnitude =
          Math.hypot(
            c.speedX,
            c.speedY,
          );

        const tailX =
          c.x -
          (c.speedX /
            magnitude) *
            c.length;

        const tailY =
          c.y -
          (c.speedY /
            magnitude) *
            c.length;

        const cometGradient =
          ctx.createLinearGradient(
            c.x,
            c.y,
            tailX,
            tailY,
          );

        cometGradient.addColorStop(
          0,
          "rgba(255, 255, 255, 0.95)",
        );

        cometGradient.addColorStop(
          0.2,
          "rgba(165, 180, 252, 0.6)",
        );

        cometGradient.addColorStop(
          1,
          "transparent",
        );

        ctx.beginPath();

        ctx.moveTo(
          c.x,
          c.y,
        );

        ctx.lineTo(
          tailX,
          tailY,
        );

        ctx.lineWidth =
          c.size;

        ctx.strokeStyle =
          cometGradient;

        ctx.shadowBlur = 10;

        ctx.shadowColor =
          "rgba(129, 140, 248, 0.8)";

        ctx.stroke();

        ctx.shadowBlur = 0;

        if (
          c.x < -100 ||
          c.x > width + 100 ||
          c.y < -100 ||
          c.y > height + 100
        ) {
          activeComet = null;
        }
      }

      animationFrameId =
        requestAnimationFrame(
          render,
        );
    };

    render();

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );

      clearInterval(
        eventInterval,
      );

      cancelAnimationFrame(
        animationFrameId,
      );
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Load Repository Analysis                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!jobId) {
      setError(
        "Analysis ID is missing.",
      );

      setIsLoading(false);

      return;
    }

    const analysisJobId =
      jobId;

    async function loadAnalysis() {
      try {
        const job =
          await getRepositoryStatus(
            analysisJobId,
          );

        if (
          job.status !==
          "completed"
        ) {
          setError(
            "Repository analysis is not completed yet.",
          );

          setIsLoading(false);

          return;
        }

        if (
          !job.architectureMap
        ) {
          setError(
            "Architecture analysis is not available.",
          );

          setIsLoading(false);

          return;
        }

        setArchitectureMap(
          job.architectureMap,
        );

        setRepositoryTree(
          job.repositoryTree ??
            null,
        );

        setIsLoading(false);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load repository analysis.",
        );

        setIsLoading(false);
      }
    }

    void loadAnalysis();
  }, [jobId]);

  /* ------------------------------------------------------------------------ */
  /* Resize AI Explanation Panel                                              */
  /* ------------------------------------------------------------------------ */

  const handleResizeMove =
    useCallback(
      (event: MouseEvent) => {
        const delta =
          resizeStartXRef.current -
          event.clientX;

        const nextWidth =
          Math.min(
            MAX_EXPLANATION_PANEL_WIDTH,
            Math.max(
              MIN_EXPLANATION_PANEL_WIDTH,
              resizeStartWidthRef.current +
                delta,
            ),
          );

        setExplanationPanelWidth(
          nextWidth,
        );
      },
      [],
    );

  const handleResizeEnd =
    useCallback(() => {
      setIsResizingExplanation(
        false,
      );

      document.body.style.userSelect =
        "";

      document.body.style.cursor =
        "";

      document.removeEventListener(
        "mousemove",
        handleResizeMove,
      );

      document.removeEventListener(
        "mouseup",
        handleResizeEnd,
      );
    }, [
      handleResizeMove,
    ]);

  const handleResizeStart =
    useCallback(
      (
        event: React.MouseEvent<HTMLDivElement>,
      ) => {
        event.preventDefault();

        resizeStartXRef.current =
          event.clientX;

        resizeStartWidthRef.current =
          explanationPanelWidth;

        setIsResizingExplanation(
          true,
        );

        document.body.style.userSelect =
          "none";

        document.body.style.cursor =
          "col-resize";

        document.addEventListener(
          "mousemove",
          handleResizeMove,
        );

        document.addEventListener(
          "mouseup",
          handleResizeEnd,
        );
      },
      [
        explanationPanelWidth,
        handleResizeMove,
        handleResizeEnd,
      ],
    );

  useEffect(() => {
    return () => {
      document.removeEventListener(
        "mousemove",
        handleResizeMove,
      );

      document.removeEventListener(
        "mouseup",
        handleResizeEnd,
      );

      document.body.style.userSelect =
        "";

      document.body.style.cursor =
        "";
    };
  }, [
    handleResizeMove,
    handleResizeEnd,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Build Explainer Context                                                  */
  /* ------------------------------------------------------------------------ */

  const buildRepositoryContext =
    useCallback(
      (path: string) => {
        if (
          architectureMap?.type ===
          "structured"
        ) {
          const matchingLayers =
            architectureMap.layers.filter(
              (layer) =>
                layer.files.includes(
                  path,
                ),
            );

          if (
            matchingLayers.length > 0
          ) {
            return [
              `Repository summary: ${architectureMap.summary}`,
              "",
              matchingLayers
                .map(
                  (layer) =>
                    `Layer: ${layer.name}\nDescription: ${layer.description}`,
                )
                .join("\n\n"),
            ].join("\n");
          }

          return `Repository summary: ${architectureMap.summary}`;
        }

        if (
          architectureMap?.type ===
          "importance-ranked"
        ) {
          const rankedFile =
            architectureMap.rankedFiles.find(
              (ranked) =>
                ranked.path === path,
            );

          return [
            `Repository summary: ${architectureMap.summary}`,
            rankedFile
              ? `File importance score: ${rankedFile.importanceScore}\nReason: ${rankedFile.reason}`
              : "No ranking information is available for this file.",
          ].join("\n\n");
        }

        return "No additional repository context provided.";
      },
      [architectureMap],
    );

  /* ------------------------------------------------------------------------ */
  /* File Selection                                                           */
  /* ------------------------------------------------------------------------ */

  const handleFileSelect =
    useCallback(
      async (
        path: string,
        node: RepositoryTreeNode,
      ) => {
        if (
          node.type !== "file" ||
          !jobId
        ) {
          return;
        }

        try {
          setIsFileLoading(true);

          setSelectedFile(null);

          setFileExplanation(null);

          setExplanationError(null);

          const file =
            await getRepositoryFile(
              jobId,
              path,
            );

          setSelectedFile(file);
        } catch (error) {
          console.error(
            "Unable to load repository file",
            error,
          );

          setExplanationError(
            "Unable to load this file.",
          );
        } finally {
          setIsFileLoading(false);
        }
      },
      [jobId],
    );

  /* ------------------------------------------------------------------------ */
  /* Explain Selected File                                                    */
  /* ------------------------------------------------------------------------ */

  const handleExplainFile =
    useCallback(async () => {
      if (
        !selectedFile ||
        !jobId
      ) {
        return;
      }

      setIsExplanationOpen(
        true,
      );

      if (fileExplanation) {
        return;
      }

      try {
        setIsExplanationLoading(
          true,
        );

        setExplanationError(
          null,
        );

        const repositoryContext =
          buildRepositoryContext(
            selectedFile.path,
          );

        const explanation =
          await explainFile({
            repositoryId: jobId,
            filePath:
              selectedFile.path,
            content:
              selectedFile.content,
            repositoryContext,
          });

        setFileExplanation(
          explanation,
        );
      } catch (error) {
        console.error(
          "Unable to explain repository file",
          error,
        );

        setExplanationError(
          "Unable to generate an explanation for this file.",
        );
      } finally {
        setIsExplanationLoading(
          false,
        );
      }
    }, [
      selectedFile,
      fileExplanation,
      buildRepositoryContext,
      jobId,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Toggle Explanation Panel                                                 */
  /* ------------------------------------------------------------------------ */

  const handleExplanationToggle =
    useCallback(() => {
      if (isExplanationOpen) {
        setIsExplanationOpen(
          false,
        );

        return;
      }

      void handleExplainFile();
    }, [
      isExplanationOpen,
      handleExplainFile,
    ]);

  const totalFiles =
    architectureMap?.type ===
    "structured"
      ? architectureMap.layers.reduce(
          (sum, layer) =>
            sum +
            layer.files.length,
          0,
        )
      : architectureMap?.type ===
          "importance-ranked"
        ? architectureMap.rankedFiles
            .length
        : 0;

  return (
    <main
      className={`relative min-h-screen w-full overflow-hidden text-[#EDEDEF] selection:bg-indigo-500/30 ${
        isResizingExplanation
          ? "select-none"
          : ""
      }`}
    >
      {/* Canvas particle space canvas */}

      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}

        <header className="border-b border-white/[0.07] bg-[#05060A]/70 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-slate-400">
                analysis · {jobId}
              </p>

              <h1 className="mt-0.5 truncate text-[17px] font-medium tracking-tight text-white">
                {repositoryLabel}
              </h1>
            </div>

            {architectureMap && (
              <nav className="flex shrink-0 gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-lg">
                {(
                  [
                    "overview",
                    "architecture",
                    "qa",
                  ] as Tab[]
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setTab(t)
                    }
                    className={`rounded-md px-3.5 py-1.5 text-[13px] capitalize transition-all duration-200 ${
                      tab === t
                        ? "border border-indigo-400/30 bg-indigo-600/35 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t === "qa"
                      ? "Q&A"
                      : t}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </header>

        {/* Content Viewport */}

        <div
          className={
            tab === "architecture" ||
            tab === "qa"
              ? "w-full flex-1 px-4 py-4"
              : "mx-auto flex w-full max-w-[1200px] flex-1 px-6 py-8"
          }
        >
          {isLoading && (
            <p className="font-mono text-[14px] text-slate-400">
              Reading the repository universe…
            </p>
          )}

          {error && (
            <p className="border-l-2 border-[#C0503F] pl-3 text-[14px] text-[#E08A7C]">
              {error}
            </p>
          )}

          {!isLoading &&
            !error &&
            architectureMap && (
              <>
                {/* Overview Tab */}

                {tab ===
                  "overview" && (
                  <div className="max-w-[760px]">
                    <div className="flex flex-wrap gap-3">
                      <StatChip
                        label="Structure"
                        value={
                          architectureMap.type ===
                          "structured"
                            ? "Clear"
                            : "Loose"
                        }
                      />

                      <StatChip
                        label={
                          architectureMap.type ===
                          "structured"
                            ? "Layers"
                            : "Ranked files"
                        }
                        value={
                          architectureMap.type ===
                          "structured"
                            ? architectureMap
                                .layers
                                .length
                            : architectureMap
                                .rankedFiles
                                .length
                        }
                      />

                      <StatChip
                        label="Files"
                        value={
                          totalFiles
                        }
                      />
                    </div>

                    <p className="mt-6 text-[15px] leading-7 text-slate-300">
                      {
                        architectureMap.summary
                      }
                    </p>

                    {architectureMap.type ===
                    "structured" ? (
                      <div className="mt-8 space-y-3">
                        {architectureMap.layers.map(
                          (layer) => (
                            <div
                              key={
                                layer.name
                              }
                              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-md"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[14px] font-medium text-white">
                                  {
                                    layer.name
                                  }
                                </span>

                                <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-slate-400">
                                  {
                                    layer
                                      .files
                                      .length
                                  }{" "}
                                  file
                                  {layer
                                    .files
                                    .length ===
                                  1
                                    ? ""
                                    : "s"}
                                </span>
                              </div>

                              <p className="mt-1.5 text-[13px] leading-6 text-slate-400">
                                {
                                  layer.description
                                }
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="mt-8 space-y-3">
                        {architectureMap.rankedFiles.map(
                          (file) => (
                            <div
                              key={
                                file.path
                              }
                              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-md"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate font-mono text-[12px] text-white">
                                  {
                                    file.path
                                  }
                                </span>

                                <span className="shrink-0 font-mono text-[11px] text-indigo-400">
                                  {file.importanceScore.toFixed(
                                    2,
                                  )}
                                </span>
                              </div>

                              <p className="mt-1.5 text-[13px] leading-6 text-slate-400">
                                {
                                  file.reason
                                }
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Architecture Tab */}

                {tab ===
                  "architecture" && (
                  <div className="flex h-[calc(100vh-140px)] w-full gap-4">
                    {/* Repository Tree */}

                    <div className="w-[300px] shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      {repositoryTree ? (
                        <RepositoryTree
                          tree={
                            repositoryTree
                          }
                          onSelectFile={
                            handleFileSelect
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-slate-400">
                          Repository tree is not available.
                        </div>
                      )}
                    </div>

                    {/* Source + Optional AI Explanation */}

                    <div className="flex min-w-0 flex-1">
                      {/* Source Viewer */}

                      <div
                        className={`min-w-0 flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#08090D] ${
                          isExplanationOpen
                            ? "rounded-r-none border-r-0"
                            : ""
                        }`}
                      >
                        {isFileLoading ? (
                          <div className="flex h-full items-center justify-center">
                            <p className="font-mono text-[13px] text-slate-500">
                              Loading source...
                            </p>
                          </div>
                        ) : selectedFile ? (
                          <div className="flex h-full flex-col">
                            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
                              <div className="min-w-0">
                                <p className="font-mono text-[11px] text-slate-500">
                                  SOURCE
                                </p>

                                <p
                                  className="mt-0.5 truncate font-mono text-[13px] text-slate-200"
                                  title={
                                    selectedFile.path
                                  }
                                >
                                  {
                                    selectedFile.path
                                  }
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={
                                  handleExplanationToggle
                                }
                                className={`group flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all ${
                                  isExplanationOpen
                                    ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/20"
                                    : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-indigo-200"
                                }`}
                                aria-expanded={
                                  isExplanationOpen
                                }
                              >
                                {isExplanationOpen ? (
                                  <PanelRightClose className="h-3.5 w-3.5" />
                                ) : (
                                  <Brain className="h-3.5 w-3.5 text-indigo-400" />
                                )}

                                <span>
                                  {isExplanationOpen
                                    ? "Hide AI"
                                    : "Explain with AI"}
                                </span>
                              </button>
                            </div>

                            <div className="custom-scrollbar flex-1 overflow-auto">
                              <pre className="min-h-full px-5 py-5 font-mono text-[12px] leading-6 text-slate-300">
                                <code>
                                  {
                                    selectedFile.content
                                  }
                                </code>
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                            <p className="font-mono text-[13px] text-slate-400">
                              Select a file
                            </p>

                            <p className="mt-2 max-w-sm text-[12px] leading-5 text-slate-600">
                              Choose a file from the repository tree to inspect its source code.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Resizable AI Explanation Panel */}

                      {isExplanationOpen && (
                        <>
                          <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize AI explanation panel"
                            onMouseDown={
                              handleResizeStart
                            }
                            title="Drag to resize"
                            className={`group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center border-y border-white/[0.08] bg-[#08090D] transition-colors ${
                              isResizingExplanation
                                ? "bg-indigo-500/10"
                                : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <span className="flex h-10 w-3 items-center justify-center rounded-full border border-white/[0.08] bg-slate-900 text-slate-600 transition-colors group-hover:border-indigo-400/20 group-hover:text-indigo-300">
                              <GripVertical className="h-3.5 w-3.5" />
                            </span>
                          </div>

                          <div
                            className="shrink-0 overflow-hidden rounded-r-xl border border-white/[0.08] border-l-0 bg-[#08090D]"
                            style={{
                              width: `${explanationPanelWidth}px`,
                            }}
                          >
                            <ExplanationPanel
                              explanation={
                                fileExplanation
                              }
                              isLoading={
                                isExplanationLoading
                              }
                              error={
                                explanationError
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Q&A Tab */}

                {tab === "qa" && (
                  <QAChat
                    repositoryId={
                      jobId ?? ""
                    }
                    repositoryTree={
                      repositoryTree
                    }
                    onSelectFile={
                      handleFileSelect
                    }
                  />
                )}
              </>
            )}
        </div>
      </div>
    </main>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 backdrop-blur-md">
      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-0.5 text-[14px] font-medium text-white">
        {value}
      </p>
    </div>
  );
}