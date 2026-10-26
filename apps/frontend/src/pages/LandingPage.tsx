import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  analyzeRepository,
  getRepositoryStatus,
  type RepositoryAnalysisStatus,
} from "../lib/repository.api";

/* Palette: #F2E9E4 cream (page), #22223B indigo (ink and the graph window), #4A4E69 slate (lines, muted text). */

/* Fonts (Syne, DM Sans, JetBrains Mono) are loaded from <link> tags in index.html, not here. */
const STYLE = `
.cn-display { font-family: 'Syne', 'Trebuchet MS', system-ui, sans-serif; }
.cn-body { font-family: 'DM Sans', system-ui, sans-serif; }
.cn-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

@keyframes cn-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes cn-pop  { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes cn-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cn-dash { to { stroke-dashoffset: -24; } }
@keyframes cn-ring { 0% { r: 10; opacity: .6; } 100% { r: 34; opacity: 0; } }
@keyframes cn-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }

.cn-rise { animation: cn-rise .8s cubic-bezier(.2,.7,.2,1) backwards; }
.cn-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: cn-draw .9s ease-out forwards; transition: stroke .25s, stroke-opacity .25s, stroke-width .25s; }
.cn-flow { stroke-dasharray: 3 5; animation: cn-dash 1.4s linear infinite; }
.cn-ring { animation: cn-ring 3s ease-out 2s infinite; }
.cn-dot { transform-box: fill-box; transform-origin: center; animation: cn-pop .55s cubic-bezier(.2,.9,.3,1.4) backwards; animation-delay: var(--d); transition: stroke .2s; }
.cn-label { animation: cn-fade .5s ease-out backwards; animation-delay: var(--d); transition: fill .2s; }
.cn-node { cursor: pointer; outline: none; transition: opacity .25s; }
.cn-node:focus-visible .cn-dot { stroke: #F2E9E4; stroke-width: 2.4; }

@media (prefers-reduced-motion: reduce) {
  .cn-rise, .cn-dot, .cn-label, .cn-flow, .cn-ring { animation: none; }
  .cn-draw { animation: none; stroke-dashoffset: 0; }
  .cn-pulse { display: none; }
}
`;

/* ---------- Demo graph (example data only) ---------- */

type N = { id: string; x: number; y: number; label: string; core?: boolean };

const NODES: N[] = [
  { id: "entry", x: 80, y: 110, label: "main.ts" },
  { id: "router", x: 290, y: 60, label: "router.ts" },
  { id: "core", x: 330, y: 270, label: "engine/core.ts", core: true },
  { id: "auth", x: 510, y: 150, label: "auth.ts" },
  { id: "db", x: 500, y: 390, label: "db/client.ts" },
  { id: "ui", x: 100, y: 340, label: "ui/App.tsx" },
  { id: "hooks", x: 60, y: 480, label: "ui/hooks.ts" },
  { id: "utils", x: 260, y: 505, label: "utils.ts" },
  { id: "cache", x: 470, y: 520, label: "cache.ts" },
];

// [from, to] means "from imports to"
const EDGES: [string, string][] = [
  ["entry", "router"], ["router", "core"], ["router", "auth"], ["core", "db"], ["entry", "ui"],
  ["ui", "core"], ["ui", "hooks"], ["core", "utils"], ["core", "cache"], ["auth", "db"],
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

function curve(a: N, b: N, bow: number) {
  const cx = (a.x + b.x) / 2 - (b.y - a.y) * bow;
  const cy = (a.y + b.y) / 2 + (b.x - a.x) * bow;
  return `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`;
}

function GraphWindow() {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 2400);
    return () => clearTimeout(t);
  }, []);

  const active = hover ?? pinned;
  const linked = new Set<string>();
  if (active) {
    linked.add(active);
    EDGES.forEach(([a, b]) => {
      if (a === active) linked.add(b);
      if (b === active) linked.add(a);
    });
  }
  const imports = active ? EDGES.filter(([a]) => a === active).length : 0;
  const usedBy = active ? EDGES.filter(([, b]) => b === active).length : 0;

  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-[#22223B] shadow-[0_40px_80px_-30px_rgba(34,34,59,0.6)]">
      {/* Window bar */}
      <div className="flex items-center gap-2 border-b border-[#4A4E69]/60 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#4A4E69]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4A4E69]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4A4E69]" />
        <span className="cn-mono ml-3 text-xs text-[#F2E9E4]/60">acme/engine</span>
        <span className="cn-mono rounded-full border border-[#4A4E69] px-2 py-0.5 text-[10px] text-[#F2E9E4]/70">
          Example
        </span>
        <span className="cn-mono ml-auto flex items-center gap-2 text-xs text-[#F2E9E4]/70">
          <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-[#F2E9E4]" : "animate-pulse bg-[#4A4E69]"}`} />
          {done ? `${NODES.length} files, ${EDGES.length} links` : "Analyzing"}
        </span>
      </div>

      <div className="relative p-4 sm:p-6">
        <svg
          viewBox="0 0 640 580"
          className="h-auto w-full overflow-visible"
          fill="none"
          role="group"
          aria-label="Example architecture graph of a code repository"
        >
          <defs>
            <radialGradient id="cn-core-glow">
              <stop offset="0%" stopColor="#4A4E69" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4A4E69" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={330} cy={270} r={190} fill="url(#cn-core-glow)" />

          {EDGES.map(([a, b], i) => {
            const d = curve(byId[a], byId[b], i % 2 ? 0.1 : -0.1);
            const touches = a === active || b === active;
            const on = !active || touches;
            return (
              <g key={`${a}-${b}`}>
                <path
                  d={d}
                  pathLength={1}
                  className="cn-draw"
                  style={{ animationDelay: `${0.5 + i * 0.12}s` }}
                  stroke={touches ? "#F2E9E4" : "#4A4E69"}
                  strokeOpacity={touches ? 0.95 : on ? 1 : 0.3}
                  strokeWidth={touches ? 1.8 : 1.2}
                />
                {touches && <path d={d} className="cn-flow" stroke="#F2E9E4" strokeWidth="1.8" />}
                {on && (
                  <circle r="2.5" fill="#F2E9E4" className="cn-pulse">
                    <animateMotion dur={`${3.2 + (i % 4) * 0.7}s`} begin={`${2 + i * 0.45}s`} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            );
          })}

          {NODES.map((n, i) => {
            const dim = active && !linked.has(n.id);
            const isPinned = pinned === n.id;
            const lit = n.core || n.id === active;
            return (
              <g
                key={n.id}
                className="cn-node"
                style={{ opacity: dim ? 0.3 : 1, ["--d" as string]: `${i * 0.12}s` }}
                tabIndex={0}
                role="button"
                aria-pressed={isPinned}
                aria-label={`${n.label}: show connections`}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                onClick={() => setPinned(isPinned ? null : n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPinned(isPinned ? null : n.id);
                  }
                }}
              >
                {n.core && <circle cx={n.x} cy={n.y} r={10} stroke="#F2E9E4" strokeWidth="1" className="cn-ring" />}
                <circle cx={n.x} cy={n.y} r={22} fill="transparent" />
                <circle
                  className="cn-dot"
                  cx={n.x}
                  cy={n.y}
                  r={n.core ? 10 : 6.5}
                  fill={n.core || isPinned ? "#F2E9E4" : "#22223B"}
                  stroke={lit ? "#F2E9E4" : "#4A4E69"}
                  strokeWidth="1.6"
                />
                <text
                  className="cn-label"
                  x={n.x + (n.core ? 20 : 15)}
                  y={n.y + 4}
                  fill="#F2E9E4"
                  fillOpacity={lit ? 1 : 0.6}
                  fontSize="12.5"
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  stroke="#22223B"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Below the graph on small screens so it never covers nodes; overlaid on sm and up */}
        <div className="pointer-events-none mt-4 min-h-[4.5rem] w-full rounded-xl border border-[#4A4E69] bg-[#22223B]/85 px-4 py-3 text-[13px] leading-snug text-[#F2E9E4]/70 backdrop-blur sm:absolute sm:bottom-6 sm:left-6 sm:mt-0 sm:min-h-0 sm:w-[16.5rem]">
          {active ? (
            <>
              <div className="cn-mono text-[#F2E9E4]">{byId[active].label}</div>
              <div className="mt-1">
                Imports {imports} {imports === 1 ? "file" : "files"}, used by {usedBy}.
                {pinned === active && " Click again to unpin."}
              </div>
            </>
          ) : (
            "Hover or click a file to trace what it connects to."
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

const FEATURES = [
  { title: "Architecture map", text: "See how every file depends on the others, with the core modules in the middle." },
  { title: "File explainer", text: "Pick any file and read a plain-English summary of what it does and why it exists." },
  { title: "Ask the code", text: "Ask a question about the repo and get an answer that points to the exact files." },
  { title: "Onboarding path", text: "Get a suggested reading order, so a new teammate knows where to start." },
];

const EXAMPLES = ["facebook/react", "vercel/next.js", "expressjs/express"];

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 180; // about 3 minutes
const MAX_CONSECUTIVE_FAILURES = 3;

/** Accepts "owner/repo", "github.com/owner/repo", or a full URL. */
function normalizeRepoUrl(input: string): string {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(www\.)?github\.com\//i.test(value)) return `https://${value}`;
  if (/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\/?$/.test(value)) return `https://github.com/${value}`;
  return `https://${value}`;
}

function LandingPage() {
  const navigate = useNavigate();

  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState<RepositoryAnalysisStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped whenever a run starts or is cancelled; stale async work compares against it and bails out.
  const runIdRef = useRef(0);

  function stopPolling() {
    runIdRef.current += 1;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  function fail(message: string) {
    setError(message);
    setIsAnalyzing(false);
  }

  async function pollRepositoryStatus(
    analysisJobId: string,
    url: string,
    runId: number,
    attempt = 0,
    failures = 0,
  ) {
    if (runId !== runIdRef.current) return;

    const scheduleNext = (nextFailures: number) => {
      pollingRef.current = setTimeout(() => {
        void pollRepositoryStatus(analysisJobId, url, runId, attempt + 1, nextFailures);
      }, POLL_INTERVAL_MS);
    };

    try {
      const job = await getRepositoryStatus(analysisJobId);
      if (runId !== runIdRef.current) return;

      setStatus(job.status);
      setProgress(job.progress ?? 0);
      setPhase(job.phase ?? null);

      const phaseOneReady = Boolean(
        job.capabilities?.overview &&
          job.capabilities?.architecture &&
          job.capabilities?.source,
      );

      if (phaseOneReady) {
        stopPolling();
        setIsAnalyzing(false);
        navigate(`/analysis/${analysisJobId}`, { state: { repositoryUrl: url } });
        return;
      }

      if (job.status === "failed") {
        fail("Repository analysis failed. Check the URL and try again.");
        return;
      }

      if (job.status === "processing" || job.status === "queued") {
        if (attempt + 1 >= MAX_POLLS) {
          fail("Analysis is taking longer than expected. Please try again in a few minutes.");
          return;
        }
        scheduleNext(0);
        return;
      }

      // Finished, but the results we need are not available.
      fail("Analysis finished, but the results are not available yet. Please try again.");
    } catch (err) {
      if (runId !== runIdRef.current) return;
      console.error(err);
      // Tolerate brief network blips before giving up.
      if (failures + 1 < MAX_CONSECUTIVE_FAILURES) {
        scheduleNext(failures + 1);
        return;
      }
      fail("Unable to check analysis status. Check your connection and try again.");
    }
  }

  async function handleAnalyze() {
    const value = repo.trim();
    if (!value) {
      setError("Please enter a GitHub repository URL.");
      return;
    }
    const url = normalizeRepoUrl(value);

    stopPolling();
    const runId = runIdRef.current;

    try {
      setIsAnalyzing(true);
      setError(null);
      setStatus(null);
      setProgress(0);
      setPhase(null);

      const result = await analyzeRepository(url);
      if (runId !== runIdRef.current) return;
      setStatus(result.status);

      await pollRepositoryStatus(result.jobId, url, runId);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      console.error(err);
      fail("Unable to start repository analysis. Please check the URL and try again.");
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void handleAnalyze();
  };

  return (
    <div className="cn-body relative min-h-screen bg-[#F2E9E4] text-[#22223B] selection:bg-[#22223B] selection:text-[#F2E9E4]">
      <style>{STYLE}</style>

      {/* Blueprint dots, fading out away from the hero */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(34,34,59,0.14) 1px, transparent 0)",
          backgroundSize: "26px 26px",
          WebkitMaskImage: "radial-gradient(ellipse at 70% 30%, black, transparent 70%)",
          maskImage: "radial-gradient(ellipse at 70% 30%, black, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-6 sm:px-10">
        {/* Nav */}
        <nav className="flex items-center justify-between py-6" aria-label="Main">
          <Link to="/" className="flex items-center gap-3 font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#22223B]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#F2E9E4" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="6" cy="7" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2.4" fill="#F2E9E4" />
                <path d="M7.6 8.2 10.8 16M16.6 7.5 13.2 16M8 7h8" />
              </svg>
            </span>
            <span className="cn-display text-lg tracking-tight">Codebase Navigator</span>
          </Link>
          <div className="flex items-center gap-6 text-[15px] text-[#4A4E69]">
            <a href="#features" className="hidden transition-colors hover:text-[#22223B] sm:inline">Features</a>
            <a
              href="https://github.com/ShaikSazid/codebase-navigator"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#4A4E69]/50 px-4 py-2 font-medium text-[#22223B] transition-colors hover:border-[#22223B] hover:bg-[#22223B] hover:text-[#F2E9E4]"
            >
              GitHub
            </a>
          </div>
        </nav>

        {/* Hero */}
        <header className="grid items-center gap-12 pb-20 pt-10 lg:min-h-[calc(100vh-110px)] lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-10 lg:pt-0">
          <div>
            <h1 className="cn-display cn-rise text-[clamp(2.8rem,6.4vw,5.4rem)] font-extrabold leading-[0.98] tracking-[-0.035em]">
              Read any codebase like you wrote it.
            </h1>
            <p className="cn-rise mt-6 max-w-[34rem] text-lg leading-relaxed text-[#4A4E69]" style={{ animationDelay: ".15s" }}>
              Paste a GitHub link. Get a map of how the code fits together, plain-English explanations of each file, and answers to your questions.
            </p>

            <form onSubmit={submit} className="cn-rise mt-9 max-w-[34rem]" style={{ animationDelay: ".3s" }}>
              <div className="flex flex-col gap-3 rounded-[1.6rem] border border-[#4A4E69]/40 bg-white/40 p-2 transition-colors focus-within:border-[#22223B] sm:flex-row sm:rounded-full">
                <label htmlFor="repo" className="sr-only">GitHub repository URL</label>
                <input
                  id="repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="github.com/owner/repository"
                  disabled={isAnalyzing}
                  className="cn-mono min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[#22223B] outline-none placeholder:text-[#4A4E69]/70 disabled:opacity-60"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="rounded-full bg-[#22223B] px-6 py-3 font-medium text-[#F2E9E4] transition-colors hover:bg-[#4A4E69] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22223B] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isAnalyzing ? "Analyzing…" : "Analyze repository"}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#4A4E69]">
                Try one:
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => setRepo(`github.com/${ex}`)}
                    className="cn-mono rounded-full border border-[#4A4E69]/30 px-3 py-1 text-xs transition-colors hover:border-[#22223B] hover:text-[#22223B] disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-4 min-h-5 text-sm text-[#4A4E69]" aria-live="polite">
                {error ? (
                  <span className="font-medium text-[#22223B]">{error}</span>
                ) : isAnalyzing && status === "queued" ? (
                  "Analysis queued..."
                ) : isAnalyzing && status ? (
                  phase === "ai_preparation"
                    ? `Preparing AI knowledge... ${progress}%`
                    : `Mapping repository... ${progress}%`
                ) : null}
              </div>
            </form>
          </div>

          <div className="cn-rise" style={{ animationDelay: ".25s" }}>
            <GraphWindow />
          </div>
        </header>

        {/* Features */}
        <section id="features" className="scroll-mt-8 pb-24 pt-8">
          <h2 className="cn-display max-w-[22ch] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Everything you need to get oriented in an unfamiliar repo.
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-t-2 border-[#22223B] pt-5">
                <h3 className="cn-display text-xl font-bold tracking-tight">{f.title}</h3>
                <p className="mt-3 leading-relaxed text-[#4A4E69]">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#4A4E69]/30 py-8 text-sm text-[#4A4E69]">
          <span>Codebase Navigator</span>
          <a
            href="https://github.com/ShaikSazid/codebase-navigator"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[#4A4E69]/50 underline-offset-4 hover:text-[#22223B]"
          >
            Source on GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;