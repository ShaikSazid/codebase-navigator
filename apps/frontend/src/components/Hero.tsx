import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { ArrowRight, Loader2 } from "lucide-react";

import {
  analyzeRepository,
  getRepositoryStatus,
  type RepositoryAnalysisStatus,
} from "../lib/repository.api";

function Hero() {
  const navigate = useNavigate();

  const [repositoryUrl, setRepositoryUrl] = useState("");

  const [jobId, setJobId] = useState<string | null>(null);

  const [status, setStatus] = useState<RepositoryAnalysisStatus | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [progress, setProgress] = useState(0);

  const [phase, setPhase] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  async function pollRepositoryStatus(analysisJobId: string) {
    try {
      const job = await getRepositoryStatus(analysisJobId);

      setStatus(job.status);
      setProgress(job.progress ?? 0);
      setPhase(job.phase ?? null);

      const phaseOneReady = Boolean(
        job.capabilities?.overview &&
          job.capabilities?.architecture &&
          job.capabilities?.source,
      );

      if (phaseOneReady && !hasNavigatedRef.current) {
        hasNavigatedRef.current = true;

        setIsAnalyzing(false);

        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
        }

        navigate(`/analysis/${analysisJobId}`, {
          state: {
            repositoryUrl,
          },
        });

        return;
      }

      if (job.status === "processing" || job.status === "queued") {
        pollingRef.current = setTimeout(() => {
          void pollRepositoryStatus(analysisJobId);
        }, 1000);

        return;
      }

      if (job.status === "failed") {
        setError("Repository analysis failed.");

        setIsAnalyzing(false);

        return;
      }

      setIsAnalyzing(false);
    } catch (error) {
      console.error(error);

      setError("Unable to check repository analysis status.");

      setIsAnalyzing(false);
    }
  }

  async function handleAnalyze() {
    if (!repositoryUrl.trim()) {
      setError("Please enter a GitHub repository URL.");

      return;
    }

    try {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }

      hasNavigatedRef.current = false;

      setIsAnalyzing(true);
      setError(null);
      setJobId(null);
      setStatus(null);
      setProgress(0);
      setPhase(null);

      const result = await analyzeRepository(repositoryUrl.trim());

      setJobId(result.jobId);
      setStatus(result.status);

      await pollRepositoryStatus(result.jobId);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to start repository analysis. Please check the URL and try again.",
      );

      setIsAnalyzing(false);
    }
  }

  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center sm:px-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,rgba(212,163,89,0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#1E1E21_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

      <div className="max-w-3xl">
        <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-[#2B2B30] bg-[#141417]/80 px-3.5 py-1.5 text-[11.5px] font-medium text-[#9E9A92] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D4A359] shadow-[0_0_10px_2px_rgba(212,163,89,0.6)]" />
          AI-mapped architecture, files &amp; dependencies
        </div>

        <h1 className="text-[44px] font-semibold leading-[1.04] tracking-tight text-[#EAE7E0] sm:text-[68px]">
          Understand any
          <br />
          <span className="bg-gradient-to-r from-[#E8C48A] via-[#D4A359] to-[#8A6B3A] bg-clip-text text-transparent">
            codebase.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-[15px] leading-7 text-[#9E9A92]">
          Before you touch the code, see how it fits together.
        </p>

        {/* Input */}
        <div className="mx-auto mt-10 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-[#2B2B30] bg-[#141417] p-2 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.9)] transition-all duration-300 focus-within:border-[#D4A359]/50 focus-within:shadow-[0_0_0_4px_rgba(212,163,89,0.08),0_10px_40px_-12px_rgba(0,0,0,0.9)]">
          <input
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleAnalyze();
              }
            }}
            placeholder="Paste a GitHub repository URL..."
            disabled={isAnalyzing}
            className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[14px] text-[#EAE7E0] outline-none placeholder:text-[#55534F] disabled:cursor-not-allowed disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={isAnalyzing}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#EAE7E0] px-5 text-[13px] font-semibold text-[#0D0D0E] transition-all duration-300 hover:bg-[#FAF8F5] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing
              </>
            ) : (
              <>
                Analyze
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Status line */}
        <div className="mt-5 flex h-5 items-center justify-center">
          {error && <p className="text-[12.5px] text-[#E8C48A]">{error}</p>}

          {jobId && status && !error && (
            <div className="flex items-center gap-2 text-[12.5px] text-[#9E9A92]">
              {status === "processing" && (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4A359]" />
                  <span>
                    {phase === "ai_preparation"
                      ? `Preparing AI knowledge... ${progress}%`
                      : `Mapping repository... ${progress}%`}
                  </span>
                </>
              )}

              {status === "queued" && <span>Analysis queued...</span>}

              {status === "completed" && (
                <>
                  <span className="text-[#D4A359]">✓</span>
                  <span>Analysis completed</span>
                </>
              )}

              {status === "failed" && (
                <>
                  <span className="text-[#E8C48A]">×</span>
                  <span>Analysis failed</span>
                </>
              )}
            </div>
          )}

          {!error && !jobId && (
            <p className="text-[12.5px] text-[#55534F]">
              Start with any public GitHub repository
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default Hero;