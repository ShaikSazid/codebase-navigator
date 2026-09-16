import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  getRepositoryStatus,
  type ArchitectureMap,
  type RepositoryTreeNode,
} from "../lib/repository.api";
import RepositoryTree from "../components/RepositoryTree";

type Tab = "overview" | "architecture";

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
  fadeState: "fadeIn" | "active" | "fadeOut";
  color: string;
}

export default function AnalysisPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();

  const repositoryUrl =
    (location.state as { repositoryUrl?: string } | null)?.repositoryUrl ??
    "Unknown repository";

  const repositoryLabel = repositoryUrl
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");

  const [architectureMap, setArchitectureMap] =
    useState<ArchitectureMap | null>(null);

  const [repositoryTree, setRepositoryTree] =
    useState<RepositoryTreeNode | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  /* ---------------- Dynamic Minimal Starfield & Rare Cosmic Events ---------------- */
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
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // 1. Minimal Stars (Reduced to 25 faint stars)
    const numStars = 25;
    const stars = Array.from({ length: numStars }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.2 + 0.3,
      speedY: Math.random() * 0.12 + 0.02,
      speedX: (Math.random() - 0.5) * 0.04,
      opacity: Math.random() * 0.6 + 0.15,
      pulseSpeed: Math.random() * 0.015 + 0.003,
    }));

    // Active cosmic objects
    let activeComet: Comet | null = null;
    let activeGalaxy: Galaxy | null = null;

    // Helper: Trigger Comet from random screen edge
    const spawnComet = () => {
      const side = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
      let startX = 0;
      let startY = 0;
      let vx = 0;
      let vy = 0;

      if (side === 0) {
        startX = Math.random() * width;
        startY = -50;
        vx = (Math.random() - 0.5) * 6;
        vy = Math.random() * 4 + 4;
      } else if (side === 1) {
        startX = width + 50;
        startY = Math.random() * height;
        vx = -(Math.random() * 4 + 4);
        vy = (Math.random() - 0.5) * 6;
      } else if (side === 2) {
        startX = Math.random() * width;
        startY = height + 50;
        vx = (Math.random() - 0.5) * 6;
        vy = -(Math.random() * 4 + 4);
      } else {
        startX = -50;
        startY = Math.random() * height;
        vx = Math.random() * 4 + 4;
        vy = (Math.random() - 0.5) * 6;
      }

      activeComet = {
        x: startX,
        y: startY,
        length: Math.random() * 80 + 70,
        speedX: vx,
        speedY: vy,
        size: Math.random() * 1.5 + 1.5,
        opacity: 1,
      };
    };

    // Helper: Trigger Spiral Galaxy Nebula
    const spawnGalaxy = () => {
      const colors = ["#818cf8", "#c084fc", "#38bdf8", "#f472b6"];
      activeGalaxy = {
        x: Math.random() * (width * 0.6) + width * 0.2,
        y: Math.random() * (height * 0.6) + height * 0.2,
        radius: Math.random() * 100 + 120,
        angle: 0,
        rotationSpeed: 0.002,
        opacity: 0,
        fadeState: "fadeIn",
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    };

    // Cosmic Event Timer (Spawns a Comet or Galaxy every 60-90 seconds)
    const eventInterval = setInterval(() => {
      if (Math.random() > 0.4) {
        spawnComet();
      } else {
        spawnGalaxy();
      }
    }, 75000); // 75 Seconds average

    // Render Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep Space Canvas Gradient
      const spaceGradient = ctx.createLinearGradient(0, 0, 0, height);
      spaceGradient.addColorStop(0, "#05060A");
      spaceGradient.addColorStop(0.5, "#080911");
      spaceGradient.addColorStop(1, "#040508");
      ctx.fillStyle = spaceGradient;
      ctx.fillRect(0, 0, width, height);

      // 1. Draw 25 Faint Stars
      for (const star of stars) {
        star.y -= star.speedY;
        star.x += star.speedX;
        star.opacity += Math.sin(Date.now() * star.pulseSpeed) * 0.005;

        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215, 225, 255, ${Math.max(0.1, Math.min(0.75, star.opacity))})`;
        ctx.fill();
      }

      // 2. Render Active Galaxy Nebula (If Triggered)
      if (activeGalaxy) {
        const g = activeGalaxy;
        if (g.fadeState === "fadeIn") {
          g.opacity += 0.003;
          if (g.opacity >= 0.35) g.fadeState = "active";
        } else if (g.fadeState === "active") {
          g.angle += g.rotationSpeed;
          if (Math.random() < 0.002) g.fadeState = "fadeOut";
        } else if (g.fadeState === "fadeOut") {
          g.opacity -= 0.002;
          if (g.opacity <= 0) activeGalaxy = null;
        }

        if (activeGalaxy) {
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.rotate(g.angle);

          const galaxyGradient = ctx.createRadialGradient(
            0,
            0,
            0,
            0,
            0,
            g.radius
          );
          galaxyGradient.addColorStop(0, g.color);
          galaxyGradient.addColorStop(0.4, "rgba(99, 102, 241, 0.15)");
          galaxyGradient.addColorStop(1, "transparent");

          ctx.fillStyle = galaxyGradient;
          ctx.globalAlpha = g.opacity;
          ctx.beginPath();
          ctx.ellipse(0, 0, g.radius, g.radius * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 3. Render Active Streak Comet (If Triggered)
      if (activeComet) {
        const c = activeComet;
        c.x += c.speedX;
        c.y += c.speedY;

        const tailX = c.x - (c.speedX / Math.hypot(c.speedX, c.speedY)) * c.length;
        const tailY = c.y - (c.speedY / Math.hypot(c.speedX, c.speedY)) * c.length;

        const cometGradient = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        cometGradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        cometGradient.addColorStop(0.2, "rgba(165, 180, 252, 0.6)");
        cometGradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tailX, tailY);
        ctx.lineWidth = c.size;
        ctx.strokeStyle = cometGradient;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(129, 140, 248, 0.8)";
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Clean up comet when it moves off screen
        if (
          c.x < -100 ||
          c.x > width + 100 ||
          c.y < -100 ||
          c.y > height + 100
        ) {
          activeComet = null;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(eventInterval);
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

    async function loadAnalysis() {
      try {
        const job = await getRepositoryStatus(analysisJobId);

        if (job.status !== "completed") {
          setError("Repository analysis is not completed yet.");
          setIsLoading(false);
          return;
        }

        if (!job.architectureMap) {
          setError("Architecture analysis is not available.");
          setIsLoading(false);
          return;
        }

        setArchitectureMap(job.architectureMap);
        setRepositoryTree(job.repositoryTree ?? null);
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setError("Unable to load repository analysis.");
        setIsLoading(false);
      }
    }

    loadAnalysis();
  }, [jobId]);

  const totalFiles =
    architectureMap?.type === "structured"
      ? architectureMap.layers.reduce(
          (sum, layer) => sum + layer.files.length,
          0
        )
      : architectureMap?.type === "importance-ranked"
      ? architectureMap.rankedFiles.length
      : 0;

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-[#EDEDEF] selection:bg-indigo-500/30">
      {/* Canvas particle space canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header bar */}
        <header className="border-b border-white/[0.07] bg-[#05060A]/70 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-slate-400">
                analysis · {jobId}
              </p>
              <h1 className="mt-0.5 truncate text-[17px] font-medium text-white tracking-tight">
                {repositoryLabel}
              </h1>
            </div>

            {architectureMap && (
              <nav className="flex shrink-0 gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-lg">
                {(["overview", "architecture"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3.5 py-1.5 text-[13px] capitalize transition-all duration-200 ${
                      tab === t
                        ? "bg-indigo-600/35 text-indigo-100 border border-indigo-400/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </header>

        {/* Content Viewport */}
        <div
          className={
            tab === "architecture"
              ? "w-full flex-1 px-4 py-4"
              : "mx-auto max-w-[1200px] w-full flex-1 px-6 py-8"
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

          {!isLoading && !error && architectureMap && (
            <>
              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="max-w-[760px]">
                  <div className="flex flex-wrap gap-3">
                    <StatChip
                      label="Structure"
                      value={
                        architectureMap.type === "structured"
                          ? "Clear"
                          : "Loose"
                      }
                    />
                    <StatChip
                      label={
                        architectureMap.type === "structured"
                          ? "Layers"
                          : "Ranked files"
                      }
                      value={
                        architectureMap.type === "structured"
                          ? architectureMap.layers.length
                          : architectureMap.rankedFiles.length
                      }
                    />
                    <StatChip label="Files" value={totalFiles} />
                  </div>

                  <p className="mt-6 text-[15px] leading-7 text-slate-300">
                    {architectureMap.summary}
                  </p>

                  {architectureMap.type === "structured" ? (
                    <div className="mt-8 space-y-3">
                      {architectureMap.layers.map((layer) => (
                        <div
                          key={layer.name}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-md"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[14px] font-medium text-white">
                              {layer.name}
                            </span>
                            <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-slate-400">
                              {layer.files.length} file
                              {layer.files.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-6 text-slate-400">
                            {layer.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-8 space-y-3">
                      {architectureMap.rankedFiles.map((file) => (
                        <div
                          key={file.path}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-md"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-mono text-[12px] text-white">
                              {file.path}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-indigo-400">
                              {file.importanceScore.toFixed(2)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-6 text-slate-400">
                            {file.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Architecture Tab */}
              {tab === "architecture" && (
                <div className="h-[calc(100vh-140px)] w-full">
                  {repositoryTree ? (
                    <RepositoryTree tree={repositoryTree} />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-slate-400">
                      Repository tree is not available.
                    </div>
                  )}
                </div>
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
      <p className="mt-0.5 text-[14px] font-medium text-white">{value}</p>
    </div>
  );
}