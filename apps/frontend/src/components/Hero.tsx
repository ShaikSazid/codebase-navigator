import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  analyzeRepository,
  getRepositoryStatus,
  type RepositoryAnalysisStatus,
} from "../lib/repository.api";

function Hero() {
  const navigate = useNavigate();

  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] =
    useState<RepositoryAnalysisStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function pollRepositoryStatus(
    analysisJobId: string,
  ) {
    try {
      const job = await getRepositoryStatus(
        analysisJobId,
      );

      setStatus(job.status);

      if (job.status === "processing") {
        setTimeout(() => {
          pollRepositoryStatus(analysisJobId);
        }, 1000);

        return;
      }

      if (job.status === "queued") {
        setTimeout(() => {
          pollRepositoryStatus(analysisJobId);
        }, 1000);

        return;
      }

      if (job.status === "completed") {
        setIsAnalyzing(false);

        navigate(`/analysis/${analysisJobId}`, {
          state: {
            repositoryUrl,
          },
        });

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
      setIsAnalyzing(true);
      setError(null);
      setJobId(null);
      setStatus(null);

      const result = await analyzeRepository(
        repositoryUrl.trim(),
      );

      setJobId(result.jobId);
      setStatus(result.status);

      pollRepositoryStatus(result.jobId);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to start repository analysis. Please check the URL and try again.",
      );

      setIsAnalyzing(false);
    }
  }

  return (
    <section className="flex flex-1 items-center justify-center px-6 pb-8">
      <div className="flex w-full max-w-4xl flex-col items-center text-center">
        {/* Label */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          AI-powered codebase intelligence
        </div>

        {/* Heading */}
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Understand any codebase.
          <span className="block bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            Before you touch the code.
          </span>
        </h1>

        {/* Description */}
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/40 sm:text-base">
          Analyze a GitHub repository and discover how
          its architecture, files, and dependencies fit
          together.
        </p>

        {/* Repository input */}
        <div className="mt-6 flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition focus-within:border-violet-400/40">
            <span className="mr-3 text-white/30">
              ◇
            </span>

            <input
              type="url"
              value={repositoryUrl}
              onChange={(event) =>
                setRepositoryUrl(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAnalyze();
                }
              }}
              placeholder="Paste a GitHub repository URL..."
              disabled={isAnalyzing}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze →"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* Analysis status */}
        {jobId && status && !error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs">
            {status === "processing" && (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />

                <span className="text-white/50">
                  Analyzing repository...
                </span>
              </>
            )}

            {status === "queued" && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />

                <span className="text-white/50">
                  Analysis queued...
                </span>
              </>
            )}

            {status === "completed" && (
              <>
                <span className="text-green-400">
                  ✓
                </span>

                <span className="text-white/50">
                  Analysis completed
                </span>
              </>
            )}

            {status === "failed" && (
              <>
                <span className="text-red-400">
                  ×
                </span>

                <span className="text-white/50">
                  Analysis failed
                </span>
              </>
            )}
          </div>
        )}

        {!error && !jobId && (
          <p className="mt-2 text-xs text-white/20">
            Start with any public GitHub repository
          </p>
        )}

        {/* Product preview */}
        <div className="mt-7 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#090909] text-left shadow-2xl shadow-black/40">
          {/* Window header */}
          <div className="flex h-9 items-center border-b border-white/5 px-4">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white/10" />
              <span className="h-2 w-2 rounded-full bg-white/10" />
              <span className="h-2 w-2 rounded-full bg-white/10" />
            </div>

            <div className="mx-auto rounded-md bg-white/[0.03] px-16 py-1 text-[9px] text-white/20">
              codebase-navigator
            </div>
          </div>

          {/* Preview body */}
          <div className="flex h-40 sm:h-44">
            {/* Sidebar */}
            <div className="hidden w-36 border-r border-white/5 p-3 sm:block">
              <div className="mb-3 text-[9px] font-medium text-white/30">
                PROJECT
              </div>

              <div className="space-y-2 text-[9px] text-white/25">
                <div className="text-violet-300/70">
                  ◈ Overview
                </div>

                <div>◇ Architecture</div>
                <div>◇ Files</div>
                <div>◇ Dependencies</div>
                <div>◇ Ask AI</div>
              </div>
            </div>

            {/* Architecture */}
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-3">
                <div className="text-xs font-medium text-white/70">
                  Architecture
                </div>

                <div className="mt-1 text-[9px] text-white/25">
                  Generated from the repository structure
                </div>
              </div>

              <div className="flex flex-1 items-center justify-center">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="rounded-lg border border-violet-400/20 bg-violet-400/[0.06] px-3 py-2">
                    <div className="text-[9px] text-violet-300/80">
                      API
                    </div>

                    <div className="mt-1 text-[8px] text-white/25">
                      routes
                    </div>
                  </div>

                  <div className="text-[10px] text-white/15">
                    ──→
                  </div>

                  <div className="rounded-lg border border-blue-400/20 bg-blue-400/[0.06] px-3 py-2">
                    <div className="text-[9px] text-blue-300/80">
                      Services
                    </div>

                    <div className="mt-1 text-[8px] text-white/25">
                      business logic
                    </div>
                  </div>

                  <div className="text-[10px] text-white/15">
                    ──→
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="text-[9px] text-white/60">
                      Database
                    </div>

                    <div className="mt-1 text-[8px] text-white/25">
                      persistence
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;