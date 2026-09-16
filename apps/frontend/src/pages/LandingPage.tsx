import Navbar from "../components/Navbar";
import Hero from "../components/Hero";

function LandingPage() {
  return (
    <main className="relative h-screen overflow-hidden bg-[#050505] text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-30%] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-[140px]" />

        <div className="absolute bottom-[-30%] left-[10%] h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>
      <div className="relative z-10 flex h-full flex-col">
        <Navbar />
        <Hero />
      </div>
    </main>
  );
}

export default LandingPage;