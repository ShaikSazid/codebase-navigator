import { useEffect, useState } from "react";

import { useLocation, useParams } from "react-router-dom";

import {
  getRepositoryStatus,
  type ArchitectureMap,
  type RepositoryTreeNode,
} from "../lib/repository.api";

import RepositoryTree from "../components/RepositoryTree";

type Tab = "overview" | "architecture";

function AnalysisPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();

  const repositoryUrl =
    (location.state as { repositoryUrl?: string } | null)
      ?.repositoryUrl ?? "Unknown repository";

  const repositoryLabel = repositoryUrl
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");

  const [architectureMap, setArchitectureMap] =
    useState<ArchitectureMap | null>(null);

  const [repositoryTree, setRepositoryTree] =
    useState<RepositoryTreeNode | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!jobId) {
      setError("Analysis ID is missing.");
      setIsLoading(false);
      return;
    }

    const analysisJobId = jobId;

    async function loadAnalysis() {
      try {
        const job = await getRepositoryStatus(
          analysisJobId,
        );

        if (job.status !== "completed") {
          setError(
            "Repository analysis is not completed yet.",
          );
          setIsLoading(false);
          return;
        }

        if (!job.architectureMap) {
          setError(
            "Architecture analysis is not available.",
          );
          setIsLoading(false);
          return;
        }

        setArchitectureMap(job.architectureMap);

        setRepositoryTree(
          job.repositoryTree ?? null,
        );

        setIsLoading(false);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load repository analysis.",
        );

        setIsLoading(false);
      }
    }

    loadAnalysis();
  }, [jobId]);

  const totalFiles =
    architectureMap?.type === "structured"
      ? architectureMap.layers.reduce(
          (sum, layer) =>
            sum + layer.files.length,
          0,
        )
      : architectureMap?.type ===
          "importance-ranked"
        ? architectureMap.rankedFiles.length
        : 0;

  return (
    <main className="min-h-screen bg-[#0E0F12] text-[#EDEDEF]">
      {/* Top bar */}
      <header className="border-b border-[#1E2027] px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-[#6B7080]">
              analysis · {jobId}
            </p>

            <h1 className="mt-0.5 truncate text-[17px] font-medium">
              {repositoryLabel}
            </h1>
          </div>

          {architectureMap && (
            <nav className="flex shrink-0 gap-1 rounded-lg border border-[#1E2027] bg-[#131419] p-1">
              {(
                ["overview", "architecture"] as Tab[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 text-[13px] capitalize transition ${
                    tab === t
                      ? "bg-[#1E2027] text-white"
                      : "text-[#6B7080] hover:text-[#B0B4BD]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 py-8">
        {/* Loading */}
        {isLoading && (
          <p className="text-[14px] text-[#6B7080]">
            Reading the repository…
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="border-l-2 border-[#C0503F] pl-3 text-[14px] text-[#E08A7C]">
            {error}
          </p>
        )}

        {/* Analysis */}
        {!isLoading &&
          !error &&
          architectureMap && (
            <>
              {/* ============================= */}
              {/* OVERVIEW */}
              {/* ============================= */}

              {tab === "overview" && (
                <div className="max-w-[760px]">
                  {/* Stat chips */}
                  <div className="flex flex-wrap gap-3">
                    <StatChip
                      label="Structure"
                      value={
                        architectureMap.type ===
                        "structured"
                          ? "Clear"
                          : "Loose"
                      }
                    />

                    <StatChip
                      label={
                        architectureMap.type ===
                        "structured"
                          ? "Layers"
                          : "Ranked files"
                      }
                      value={
                        architectureMap.type ===
                        "structured"
                          ? architectureMap.layers.length
                          : architectureMap.rankedFiles.length
                      }
                    />

                    <StatChip
                      label="Files"
                      value={totalFiles}
                    />
                  </div>

                  {/* Summary */}
                  <p className="mt-6 text-[15px] leading-7 text-[#C7CAD1]">
                    {architectureMap.summary}
                  </p>

                  {/* Structured architecture */}
                  {architectureMap.type ===
                  "structured" ? (
                    <div className="mt-8 space-y-3">
                      {architectureMap.layers.map(
                        (layer) => (
                          <div
                            key={layer.name}
                            className="rounded-lg border border-[#1E2027] bg-[#131419] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[14px] font-medium text-white">
                                {layer.name}
                              </span>

                              <span className="shrink-0 rounded-full bg-[#1E2027] px-2 py-0.5 font-mono text-[11px] text-[#8A8F98]">
                                {layer.files.length}{" "}
                                file
                                {layer.files.length ===
                                1
                                  ? ""
                                  : "s"}
                              </span>
                            </div>

                            <p className="mt-1.5 text-[13px] leading-6 text-[#8A8F98]">
                              {layer.description}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    /* Importance-ranked architecture */
                    <div className="mt-8 space-y-3">
                      {architectureMap.rankedFiles.map(
                        (file) => (
                          <div
                            key={file.path}
                            className="rounded-lg border border-[#1E2027] bg-[#131419] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate font-mono text-[12px] text-white">
                                {file.path}
                              </span>

                              <span className="shrink-0 font-mono text-[11px] text-[#5B57C9]">
                                {file.importanceScore.toFixed(
                                  2,
                                )}
                              </span>
                            </div>

                            <p className="mt-1.5 text-[13px] leading-6 text-[#8A8F98]">
                              {file.reason}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ============================= */}
              {/* ARCHITECTURE */}
              {/* ============================= */}

              {tab === "architecture" && (
                <div className="h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[#1E2027]">
                  {repositoryTree ? (
                    <RepositoryTree
                      tree={repositoryTree}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-[#6B7080]">
                      Repository tree is not available.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </main>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[#1E2027] bg-[#131419] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7080]">
        {label}
      </p>

      <p className="mt-0.5 text-[14px] font-medium text-white">
        {value}
      </p>
    </div>
  );
}

export default AnalysisPage;