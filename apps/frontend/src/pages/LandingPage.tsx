import Navbar from "../components/Navbar";
import Hero from "../components/Hero";

function LandingPage() {
  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#121212] text-[#E0E0E0]">
      {/* Atmosphere — tonal only, no color */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[-15%] h-[520px] w-[520px] rounded-full bg-[#888888]/[0.08] blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[5%] h-[480px] w-[480px] rounded-full bg-[#444444]/[0.25] blur-[150px]" />

        {/* Abstract horizon lines */}
        <svg
          className="absolute bottom-0 left-0 h-[42%] w-full opacity-[0.5]"
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 320 L180 210 L340 280 L520 140 L720 260 L920 120 L1140 250 L1300 180 L1440 260 L1440 400 L0 400 Z"
            fill="#1C1C1C"
          />
          <path
            d="M0 360 L220 290 L400 330 L620 240 L840 320 L1080 220 L1260 300 L1440 260 L1440 400 L0 400 Z"
            fill="#161616"
          />
        </svg>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(224,224,224,0.04)_1px,transparent_0)] bg-[size:28px_28px]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <Navbar />
        <Hero />
      </div>
    </main>
  );
}

export default LandingPage;