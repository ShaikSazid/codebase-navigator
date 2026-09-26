import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  analyzeRepository,
  getRepositoryStatus,
  type RepositoryAnalysisStatus,
} from "../lib/repository.api";

function Hero() {
  const navigate = useNavigate();

  const [repositoryUrl, setRepositoryUrl] =
    useState("");

  const [jobId, setJobId] =
    useState<string | null>(null);

  const [status, setStatus] =
    useState<RepositoryAnalysisStatus | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [phase, setPhase] =
    useState<string | null>(null);

  const pollingRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const hasNavigatedRef =
    useRef(false);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(
          pollingRef.current,
        );
      }
    };
  }, []);

  async function pollRepositoryStatus(
    analysisJobId: string,
  ) {
    try {
      const job =
        await getRepositoryStatus(
          analysisJobId,
        );

      setStatus(job.status);
      setProgress(job.progress ?? 0);
      setPhase(job.phase ?? null);

      const phaseOneReady =
        Boolean(
          job.capabilities?.overview &&
            job.capabilities?.architecture &&
            job.capabilities?.source,
        );

      if (
        phaseOneReady &&
        !hasNavigatedRef.current
      ) {
        hasNavigatedRef.current =
          true;

        setIsAnalyzing(false);

        if (pollingRef.current) {
          clearTimeout(
            pollingRef.current,
          );
        }

        navigate(
          `/analysis/${analysisJobId}`,
          {
            state: {
              repositoryUrl,
            },
          },
        );

        return;
      }

      if (
        job.status === "processing" ||
        job.status === "queued"
      ) {
        pollingRef.current =
          setTimeout(() => {
            void pollRepositoryStatus(
              analysisJobId,
            );
          }, 1000);

        return;
      }

      if (
        job.status === "failed"
      ) {
        setError(
          "Repository analysis failed.",
        );

        setIsAnalyzing(false);

        return;
      }

      setIsAnalyzing(false);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to check repository analysis status.",
      );

      setIsAnalyzing(false);
    }
  }

  async function handleAnalyze() {
    if (!repositoryUrl.trim()) {
      setError(
        "Please enter a GitHub repository URL.",
      );

      return;
    }

    try {
      if (pollingRef.current) {
        clearTimeout(
          pollingRef.current,
        );
      }

      hasNavigatedRef.current =
        false;

      setIsAnalyzing(true);
      setError(null);
      setJobId(null);
      setStatus(null);
      setProgress(0);
      setPhase(null);

      const result =
        await analyzeRepository(
          repositoryUrl.trim(),
        );

      setJobId(result.jobId);
      setStatus(result.status);

      await pollRepositoryStatus(
        result.jobId,
      );
    } catch (error) {
      console.error(error);

      setError(
        "Unable to start repository analysis. Please check the URL and try again.",
      );

      setIsAnalyzing(false);
    }
  }

  return (
    <section className="relative flex flex-1 flex-col justify-center px-6 sm:px-10">
      <div className="max-w-3xl -translate-y-6">
        <div className="mb-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#888888]">
          <span className="h-1 w-1 rounded-full bg-[#E0E0E0]" />
          Introducing
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <h1 className="text-[44px] font-bold leading-[1.02] tracking-tight text-[#E0E0E0] sm:text-[64px]">
            Understand
            <span className="text-[#888888]"> →</span>
            <br />
            any codebase.
          </h1>

          <p className="mb-2 max-w-[220px] text-[13px] leading-5 text-[#888888]">
            Before you touch the code. AI-mapped architecture, files &amp;
            dependencies.
          </p>
        </div>

        <div className="mt-9 flex w-full max-w-xl flex-col gap-2.5 sm:flex-row">
          <div className="flex flex-1 items-center rounded-lg border border-[#444444] bg-[#1A1A1A] px-4 py-3 transition-colors duration-300 focus-within:border-[#888888]">
            <input
              type="url"
              value={repositoryUrl}
              onChange={(event) =>
                setRepositoryUrl(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleAnalyze();
                }
              }}
              placeholder="Paste a GitHub repository URL..."
              disabled={isAnalyzing}
              className="w-full bg-transparent text-sm text-[#E0E0E0] outline-none placeholder:text-[#888888]/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={isAnalyzing}
            className="rounded-lg bg-[#E0E0E0] px-7 py-3 text-sm font-semibold text-[#121212] transition-all duration-300 hover:bg-[#F2F2F2] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        <div className="mt-4 h-5">
          {error && (
            <p className="text-xs text-[#B0B0B0]">
              {error}
            </p>
          )}

          {jobId && status && !error && (
            <div className="flex items-center gap-2 text-xs text-[#888888]">
              {status === "processing" && (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E0E0E0]" />
                  <span>
                    {phase === "ai_preparation"
                      ? `Preparing AI knowledge... ${progress}%`
                      : `Mapping repository... ${progress}%`}
                  </span>
                </>
              )}

              {status === "queued" && (
                <span>
                  Analysis queued...
                </span>
              )}

              {status === "completed" && (
                <>
                  <span className="text-[#E0E0E0]">
                    ✓
                  </span>
                  <span>
                    Analysis completed
                  </span>
                </>
              )}

              {status === "failed" && (
                <>
                  <span className="text-[#B0B0B0]">
                    ×
                  </span>
                  <span>
                    Analysis failed
                  </span>
                </>
              )}
            </div>
          )}

          {!error && !jobId && (
            <p className="text-xs text-[#888888]/50">
              Start with any public GitHub repository
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default Hero;