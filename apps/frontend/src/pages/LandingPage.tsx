import { useRef } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";

const STYLE = `
@keyframes cn-dash { to { stroke-dashoffset: -24; } }
@keyframes cn-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes cn-ring { 0% { r: 9; opacity: .55; } 100% { r: 26; opacity: 0; } }
.cn-edge { stroke-dasharray: 3 5; animation: cn-dash 2.4s linear infinite; }
.cn-graph { animation: cn-float 9s ease-in-out infinite; }
.cn-ring { animation: cn-ring 3s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cn-edge, .cn-graph, .cn-ring { animation: none; }
  .cn-pulse { display: none; }
}
`;

type N = { id: string; x: number; y: number; label: string; core?: boolean };

const NODES: N[] = [
  { id: "entry", x: 90, y: 110, label: "main.ts" },
  { id: "router", x: 300, y: 70, label: "router.ts" },
  { id: "core", x: 330, y: 270, label: "engine/core.ts", core: true },
  { id: "auth", x: 540, y: 150, label: "auth.ts" },
  { id: "db", x: 520, y: 400, label: "db/client.ts" },
  { id: "ui", x: 120, y: 340, label: "ui/App.tsx" },
  { id: "utils", x: 270, y: 500, label: "utils.ts" },
];

const EDGES: [string, string][] = [
  ["entry", "router"],
  ["router", "core"],
  ["router", "auth"],
  ["core", "db"],
  ["entry", "ui"],
  ["ui", "core"],
  ["core", "utils"],
  ["auth", "db"],
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

function ArchitectureGraph() {
  return (
    <svg
      viewBox="0 0 640 580"
      className="cn-graph h-full w-full"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cn-core-glow">
          <stop offset="0%" stopColor="#D4A359" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D4A359" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={330} cy={270} r={150} fill="url(#cn-core-glow)" />

      {EDGES.map(([a, b], i) => {
        const p = byId[a];
        const q = byId[b];
        const d = `M${p.x} ${p.y} L${q.x} ${q.y}`;
        return (
          <g key={`${a}-${b}`}>
            <path d={d} stroke="#EAE7E0" strokeOpacity="0.16" strokeWidth="1" className="cn-edge" />
            <circle r="2.2" fill="#D4A359" className="cn-pulse">
              <animateMotion dur={`${3.2 + (i % 4) * 0.7}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        );
      })}

      {NODES.map((n) => (
        <g key={n.id}>
          {n.core && <circle cx={n.x} cy={n.y} r={9} stroke="#D4A359" strokeWidth="1" className="cn-ring" />}
          <circle
            cx={n.x}
            cy={n.y}
            r={n.core ? 9 : 5.5}
            fill={n.core ? "#D4A359" : "#161619"}
            stroke={n.core ? "#D4A359" : "#EAE7E0"}
            strokeOpacity={n.core ? 1 : 0.45}
            strokeWidth="1.2"
          />
          <text
            x={n.x + (n.core ? 18 : 14)}
            y={n.y + 4}
            fill={n.core ? "#EAE7E0" : "#9E9A92"}
            fontSize="12.5"
            fontFamily="ui-monospace, 'JetBrains Mono', monospace"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function LandingPage() {
  const ref = useRef<HTMLElement | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", `${e.clientX}px`);
    el.style.setProperty("--my", `${e.clientY}px`);
  };

  return (
    <main
      ref={ref}
      onMouseMove={handleMove}
      className="relative h-screen w-full overflow-hidden bg-[#0D0D0E] text-[#EAE7E0] selection:bg-[#EAE7E0]/20"
      style={{ ["--mx" as string]: "70%", ["--my" as string]: "40%" }}
    >
      <style>{STYLE}</style>

      {/* Atmosphere — tonal, one warm accent */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6%] top-[-18%] h-[560px] w-[560px] rounded-full bg-[#9E9A92]/[0.07] blur-[160px]" />
        <div className="absolute bottom-[-22%] right-[2%] h-[520px] w-[520px] rounded-full bg-[#D4A359]/[0.07] blur-[170px]" />

        {/* Horizon */}
        <svg
          className="absolute bottom-0 left-0 h-[38%] w-full opacity-60"
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 320 L180 210 L340 280 L520 140 L720 260 L920 120 L1140 250 L1300 180 L1440 260 L1440 400 L0 400 Z"
            fill="#151517"
          />
          <path
            d="M0 360 L220 290 L400 330 L620 240 L840 320 L1080 220 L1260 300 L1440 260 L1440 400 L0 400 Z"
            fill="#101012"
          />
        </svg>

        {/* Dot grid, brightened under the cursor */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(234,231,224,0.05)_1px,transparent_0)] bg-[size:28px_28px]" />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(234,231,224,0.55)_1px,transparent_0)] bg-[size:28px_28px]"
          style={{
            WebkitMaskImage: "radial-gradient(240px circle at var(--mx) var(--my), black, transparent 70%)",
            maskImage: "radial-gradient(240px circle at var(--mx) var(--my), black, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(420px circle at var(--mx) var(--my), rgba(212,163,89,0.06), transparent 70%)" }}
        />

        {/* Edge vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* Live architecture sketch — shows what "Analyze" produces */}
      <div className="pointer-events-none absolute right-[3%] top-1/2 hidden h-[min(72vh,620px)] w-[42vw] max-w-[680px] -translate-y-1/2 xl:block">
        <ArchitectureGraph />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <Navbar />
        <Hero />
      </div>
    </main>
  );
}

export default LandingPage;