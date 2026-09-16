const features = [
  {
    number: "01",
    title: "Architecture",
    description:
      "See how the repository is organized and how its major parts connect.",
  },
  {
    number: "02",
    title: "Explainer",
    description:
      "Select a file or function and get a clear explanation grounded in the actual code.",
  },
  {
    number: "03",
    title: "AI Q&A",
    description:
      "Ask questions about the codebase and get answers backed by relevant files.",
  },
  {
    number: "04",
    title: "Onboarding",
    description:
      "Follow a personalized path to understand the repository step by step.",
  },
];

function FeaturePreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-32">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.number}
            className="group bg-[#080808] p-7 transition hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/25">
                {feature.number}
              </span>

              <span className="text-white/20 transition group-hover:text-violet-400">
                ↗
              </span>
            </div>

            <h3 className="mt-12 text-lg font-medium">
              {feature.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-white/40">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FeaturePreview;