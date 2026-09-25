import dotenv from "dotenv";

dotenv.config();

import logger from "../logger/index.js";

import { Job } from "bullmq";

import axios from "axios";

import { repositoryIngestionQueue } from "../queue/ingestion.queue.js";

type ArchitectureMap =
  | {
      type: "structured";
      layers: Array<{
        name: string;
        description: string;
        files: string[];
      }>;
      summary: string;
    }
  | {
      type: "importance-ranked";
      rankedFiles: Array<{
        path: string;
        importanceScore: number;
        reason: string;
      }>;
      summary: string;
    };

type RepositoryTreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: RepositoryTreeNode[];
};

type AnalysisPhase =
  | "repository_mapping"
  | "ai_preparation"
  | "completed"
  | "failed";

type AnalysisPhaseStatus =
  | "running"
  | "completed"
  | "failed";

type AnalysisCapabilities = {
  overview: boolean;
  architecture: boolean;
  source: boolean;
  qa: boolean;
  navigation: boolean;
};

type RepositoryMetadata = {
  repositoryId: string;
  url: string;

  status:
    | "queued"
    | "indexing"
    | "architecture"
    | "embedding"
    | "completed"
    | "failed";

  phase: AnalysisPhase;

  phaseStatus: AnalysisPhaseStatus;

  progress: number;

  capabilities: AnalysisCapabilities;

  updatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* Create repository analysis job                                             */
/* -------------------------------------------------------------------------- */

export async function createRepositoryAnalysis(
  url: string,
) {
  const jobId =
    crypto.randomUUID();

  const job =
    await repositoryIngestionQueue.add(
      "repository-analysis",
      {
        url,
        repositoryId: jobId,
      },
      {
        jobId,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

  logger.info(
    {
      jobId,
      repositoryUrl: url,
      status: "queued",
    },
    "Repository analysis job created",
  );

  return {
    message:
      "Repository analysis started",
    jobId: job.id,
    url,
    status: "queued",
  };
}

/* -------------------------------------------------------------------------- */
/* Get repository analysis status                                             */
/* -------------------------------------------------------------------------- */

export async function getRepositoryAnalysis(
  jobId: string,
) {
  const job =
    await Job.fromId(
      repositoryIngestionQueue,
      jobId,
    );

  logger.info(
    {
      jobId,
      found: Boolean(job),
    },
    "Repository analysis job lookup",
  );

  if (!job) {
    return null;
  }

  const state =
    await job.getState();

  let status:
    | "queued"
    | "processing"
    | "completed"
    | "failed";

  switch (state) {
    case "waiting":
    case "delayed":
      status = "queued";
      break;

    case "active":
      status = "processing";
      break;

    case "completed":
      status = "completed";
      break;

    case "failed":
      status = "failed";
      break;

    default:
      status = "queued";
  }

  /* ------------------------------------------------------------------------ */
  /* Get persistent metadata from ingestion service                           */
  /* ------------------------------------------------------------------------ */

  const metadata =
    await getRepositoryMetadata(
      jobId,
    );

  const result =
    job.returnvalue as
      | {
          architectureMap?: ArchitectureMap;
          repositoryTree?: RepositoryTreeNode;
        }
      | undefined;

  /*
   * BullMQ tells us the state of the background job.
   *
   * S3 metadata tells us the actual repository-analysis phase
   * and which frontend capabilities are currently available.
   */

  const response: Record<
    string,
    unknown
  > = {
    jobId: job.id,
    url: job.data.url,
    status,
  };

  /* ------------------------------------------------------------------------ */
  /* Metadata available                                                       */
  /* ------------------------------------------------------------------------ */

  if (metadata) {
    response.phase =
      metadata.phase;

    response.phaseStatus =
      metadata.phaseStatus;

    response.progress =
      metadata.progress;

    response.capabilities =
      metadata.capabilities;

    response.updatedAt =
      metadata.updatedAt;
  } else if (
    state !== "waiting" &&
    state !== "delayed"
  ) {
    /*
     * Fallback for the short period between the job being picked up
     * and the worker writing metadata to S3.
     */
    response.progress =
      job.progress;
  }

  /* ------------------------------------------------------------------------ */
  /* Completed job                                                            */
  /* ------------------------------------------------------------------------ */

  if (
    state === "completed" &&
    result
  ) {
    response.architectureMap =
      result.architectureMap;

    response.repositoryTree =
      result.repositoryTree;
  }

  /* ------------------------------------------------------------------------ */
  /* Failed job                                                               */
  /* ------------------------------------------------------------------------ */

  if (state === "failed") {
    response.error =
      job.failedReason;
  }

  return response;
}


async function getRepositoryMetadata(
  repositoryId: string,
): Promise<RepositoryMetadata | null> {
  const INGESTION_SERVICE_URL =
    process.env.INGESTION_SERVICE_URL ||
    "http://localhost:5001";

  try {
    const response =
      await axios.get<RepositoryMetadata>(
        `${INGESTION_SERVICE_URL}/internal/repositories/${repositoryId}/status`,
      );

    return response.data;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 404
    ) {
      return null;
    }

    logger.warn(
      {
        repositoryId,
        error,
      },
      "Unable to retrieve repository metadata",
    );

    return null;
  }
}


export async function getRepositoryFile(
  repositoryId: string,
  filePath: string,
) {
  const INGESTION_SERVICE_URL =
    process.env.INGESTION_SERVICE_URL ||
    "http://localhost:5001";

  const response =
    await axios.get(
      `${INGESTION_SERVICE_URL}/internal/repositories/${repositoryId}/files`,
      {
        params: {
          path: filePath,
        },
      },
    );

  return response.data;
}