import dotenv from "dotenv";

dotenv.config();

import logger from "../logger/index.js";
import { Job } from "bullmq";
import axios from "axios";

import { repositoryIngestionQueue } from "../queue/ingestion.queue.js";

type ArchitectureMap = {
  repositoryId?: string;
  repositoryName?: string;
  summary?: string;
  layers?: unknown[];
  relationships?: unknown[];
  entryPoints?: unknown[];
  [key: string]: unknown;
};

type RepositoryTreeNode = {
  name: string;
  path?: string;
  type?: string;
  children?: RepositoryTreeNode[];
  [key: string]: unknown;
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

type RepositoryAnalysisResult = {
  architectureMap?: ArchitectureMap;
  repositoryTree?: RepositoryTreeNode;
};

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL ||
  "http://localhost:5001";

export async function createRepositoryAnalysis(
  url: string,
) {
  const repositoryId =
    crypto.randomUUID();

  const job =
    await repositoryIngestionQueue.add(
      "repository-analysis",
      {
        url,
        repositoryId,
      },
      {
        jobId: repositoryId,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

  logger.info(
    {
      jobId: job.id,
      repositoryId,
      url,
    },
    "Repository analysis job created",
  );

  return {
    message:
      "Repository analysis started",
    jobId: job.id,
    repositoryId,
    url,
    status: "queued" as const,
  };
}

export async function getRepositoryAnalysis(
  jobId: string,
) {
  const job =
    await Job.fromId(
      repositoryIngestionQueue,
      jobId,
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

  if (state === "completed") {
    status = "completed";
  } else if (state === "failed") {
    status = "failed";
  } else if (
    state === "waiting" ||
    state === "delayed"
  ) {
    status = "queued";
  } else {
    status = "processing";
  }

  const metadata =
    await getRepositoryMetadata(
      job.data.repositoryId,
    );

  const result =
    job.returnvalue as
      | RepositoryAnalysisResult
      | undefined;

  const response: Record<
    string,
    unknown
  > = {
    jobId: job.id,
    url: job.data.url,
    status,
  };

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
  } else {
    response.progress =
      status === "completed"
        ? 100
        : status === "processing"
          ? 50
          : 0;
  }

  const phaseOneReady =
    metadata?.capabilities?.overview === true &&
    metadata?.capabilities?.architecture === true &&
    metadata?.capabilities?.source === true;

  if (phaseOneReady) {
    const phaseOneData =
      await getRepositoryPhaseOneData(
        job.data.repositoryId,
      );

    if (
      phaseOneData.architectureMap !==
      undefined
    ) {
      response.architectureMap =
        phaseOneData.architectureMap;
    }

    if (
      phaseOneData.repositoryTree !==
      undefined
    ) {
      response.repositoryTree =
        phaseOneData.repositoryTree;
    }
  } else if (
    state === "completed" &&
    result
  ) {
    if (
      result.architectureMap !==
      undefined
    ) {
      response.architectureMap =
        result.architectureMap;
    }

    if (
      result.repositoryTree !==
      undefined
    ) {
      response.repositoryTree =
        result.repositoryTree;
    }
  }

  if (state === "failed") {
    response.error =
      job.failedReason ||
      "Repository analysis failed";
  }

  return response;
}

async function getRepositoryPhaseOneData(
  repositoryId: string,
): Promise<RepositoryAnalysisResult> {
  const result: RepositoryAnalysisResult =
    {};

  const [
    architectureResponse,
    treeResponse,
  ] = await Promise.all([
    axios.get<{
      architectureMap?: ArchitectureMap;
    }>(
      `${INGESTION_SERVICE_URL}/internal/repositories/${repositoryId}/architecture`,
    ),
    axios.get<{
      repositoryTree?: RepositoryTreeNode;
    }>(
      `${INGESTION_SERVICE_URL}/internal/repositories/${repositoryId}/tree`,
    ),
  ]);

  if (
    architectureResponse.data
      ?.architectureMap !== undefined
  ) {
    result.architectureMap =
      architectureResponse.data
        .architectureMap;
  }

  if (
    treeResponse.data?.repositoryTree !==
    undefined
  ) {
    result.repositoryTree =
      treeResponse.data.repositoryTree;
  }

  return result;
}

async function getRepositoryMetadata(
  repositoryId: string,
): Promise<RepositoryMetadata | null> {
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

    throw error;
  }
}

export async function getRepositoryFile(
  repositoryId: string,
  filePath: string,
) {
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