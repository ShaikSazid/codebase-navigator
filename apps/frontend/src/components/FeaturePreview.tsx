import type { ReactNode } from "react";

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
.cn-features { font-family: 'Inter', system-ui, sans-serif; }
.cn-features .font-display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; }
.cn-features .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
@keyframes cn-flow { to { stroke-dashoffset: -16; } }
.cn-features .cn-flow { stroke-dasharray: 3 5; animation: cn-flow 1.6s linear infinite; }
@keyframes cn-blink { 50% { opacity: 0; } }
.cn-features .cn-caret { animation: cn-blink 1.1s steps(1) infinite; }
@media (prefers-reduced-motion: reduce) { .cn-features .cn-flow, .cn-features .cn-caret { animation: none; } }
`;

/* ---------- Vignettes: tiny pictures of what each feature produces ---------- */

function ArchitectureVignette() {
  const nodes = [
    { x: 40, y: 90, w: 78, t: "app" },
    { x: 170, y: 36, w: 88, t: "routes" },
    { x: 170, y: 144, w: 88, t: "services" },
    { x: 320, y: 36, w: 78, t: "auth" },
    { x: 320, y: 90, w: 78, t: "models" },
    { x: 320, y: 144, w: 78, t: "utils" },
  ];
  const edges = [
    "M118 104 C145 104 145 50 170 50",
    "M118 104 C145 104 145 158 170 158",
    "M258 50 C290 50 290 50 320 50",
    "M258 50 C290 50 290 104 320 104",
    "M258 158 C290 158 290 104 320 104",
    "M258 158 C290 158 290 158 320 158",
  ];
  return (
    <svg viewBox="0 0 440 200" className="h-full w-full" fill="none" aria-hidden="true">
      {edges.map((d) => (
        <path key={d} d={d} stroke="#D4A359" strokeOpacity="0.45" strokeWidth="1.2" className="cn-flow" />
      ))}
      {nodes.map((n, i) => (
        <g key={n.t}>
          <rect x={n.x} y={n.y} width={n.w} height={28} rx={8} fill={i === 0 ? "#EAE7E0" : "#161619"} stroke={i === 0 ? "#EAE7E0" : "#2B2B30"} />
          <text x={n.x + n.w / 2} y={n.y + 18} textAnchor="middle" fontSize="11.5" fontFamily="JetBrains Mono, monospace" fill={i === 0 ? "#0D0D0E" : "#C2C0B8"}>
            {n.t}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ExplainerVignette() {
  const lines = [
    ["#726E67", 40],
    ["#9E9A92", 64],
    ["#EAE7E0", 52],
    ["#9E9A92", 72],
    ["#726E67", 34],
  ] as const;
  return (
    <div className="rounded-xl border border-[#232326] bg-[#0E0E10] p-3.5 font-mono text-[11px]">
      {lines.map(([c, w], i) => (
        <div key={i} className={`mb-1.5 flex items-center gap-2.5 rounded px-1.5 py-0.5 ${i === 2 ? "bg-[#D4A359]/[0.12] ring-1 ring-[#D4A359]/30" : ""}`}>
          <span className="w-3 text-right text-[#454340]">{i + 12}</span>
          <span className="h-1.5 rounded-full" style={{ width: `${w}%`, background: c, opacity: 0.55 }} />
        </div>
      ))}
      <p className="mt-3 border-l-2 border-[#D4A359] pl-2.5 font-sans text-[11.5px] leading-5 text-[#9E9A92]">
        Validates the token, then hands the request to the router.
      </p>
    </div>
  );
}

function QAVignette() {
  return (
    <div className="space-y-2.5 text-[12px]">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#EAE7E0] px-3.5 py-2 text-[#0D0D0E]">
        Where is login handled?
      </div>
      <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-md border border-[#232326] bg-[#141417] px-3.5 py-2.5 text-[#9E9A92]">
        In <span className="font-mono text-[11px] text-[#E8C48A]">auth/session.ts</span>, called from the login route
        <span className="cn-caret ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-[#D4A359]" />
      </div>
    </div>
  );
}

function OnboardingVignette() {
  const steps = ["Read the entry point", "Follow the request path", "Open the data layer"];
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`h-2.5 w-2.5 rounded-full border ${i === 0 ? "border-[#D4A359] bg-[#D4A359]" : "border-[#454340] bg-[#0D0D0E]"}`} />
            {i < steps.length - 1 && <span className="my-1 h-5 w-px bg-[#2B2B30]" />}
          </div>
          <span className={`-mt-1 text-[12.5px] ${i === 0 ? "text-[#EAE7E0]" : "text-[#726E67]"}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Content ---------- */

const features: {
  title: string;
  description: string;
  span: string;
  vignette: ReactNode;
}[] = [
  {
    title: "Architecture",
    description: "See how the repository is organized and how its major parts connect.",
    span: "lg:col-span-4",
    vignette: <ArchitectureVignette />,
  },
  {
    title: "Explainer",
    description: "Select a file or function and get a clear explanation grounded in the actual code.",
    span: "lg:col-span-2",
    vignette: <ExplainerVignette />,
  },
  {
    title: "AI Q&A",
    description: "Ask questions about the codebase and get answers backed by relevant files.",
    span: "lg:col-span-3",
    vignette: <QAVignette />,
  },
  {
    title: "Onboarding",
    description: "Follow a personalized path to understand the repository step by step.",
    span: "lg:col-span-3",
    vignette: <OnboardingVignette />,
  },
];

function FeaturePreview() {
  return (
    <section id="features" className="cn-features relative mx-auto max-w-6xl px-6 pb-32 pt-8 text-[#EAE7E0]">
      <style>{STYLE}</style>

      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,163,89,0.07),transparent_65%)]" />

      <div className="mb-12 max-w-2xl">
        <h2 className="font-display text-[44px] leading-[1.05] tracking-tight md:text-[56px]">
          Read a repository the way its authors do.
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-7 text-[#9E9A92]">
          Four tools that turn an unfamiliar codebase into something you can navigate, question and explain.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-6">
        {features.map((feature) => (
          <article
            key={feature.title}
            className={`group relative flex flex-col overflow-hidden rounded-3xl border border-[#232326] bg-[#111113] p-6 transition-colors duration-300 hover:border-[#D4A359]/40 ${feature.span}`}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#D4A359]/0 blur-[80px] transition-colors duration-500 group-hover:bg-[#D4A359]/[0.10]" />

            <div className="relative flex min-h-[170px] flex-1 items-center">
              <div className="w-full">{feature.vignette}</div>
            </div>

            <div className="relative mt-6 border-t border-[#1E1E21] pt-5">
              <h3 className="font-display text-[26px] leading-none">{feature.title}</h3>
              <p className="mt-2.5 max-w-md text-[13.5px] leading-6 text-[#9E9A92]">{feature.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FeaturePreview;