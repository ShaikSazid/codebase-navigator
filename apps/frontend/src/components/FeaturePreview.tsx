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
    <section id="features" className="mx-auto max-w-6xl px-6 pb-32">
      <div className="mb-10 flex items-end justify-between border-b border-[#231F1B]/10 pb-6">
        <h2 className="font-['Fraunces'] text-2xl text-[#231F1B]">
          What it does
        </h2>
        <span className="hidden font-mono text-[11px] text-[#6B6255]/50 sm:block">
          04 capabilities
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-[#231F1B]/10 bg-[#231F1B]/[0.06] sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.number}
            className="group bg-[#FDFBF6] p-7 transition-colors duration-300 hover:bg-[#F7F2E7]"
          >
            <div className="flex items-center justify-between">
              <span className="font-['Fraunces'] text-xs italic text-[#6B6255]/50">
                {feature.number}
              </span>

              <span className="text-[#6B6255]/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#BC5B31]">
                ↗
              </span>
            </div>

            <h3 className="mt-12 font-['Fraunces'] text-lg text-[#231F1B]">
              {feature.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#6B6255]">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FeaturePreview;