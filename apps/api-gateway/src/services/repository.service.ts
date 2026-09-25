import dotenv from "dotenv";
dotenv.config();

import logger from "../logger/index.js";
import { Job } from "bullmq";
import { randomUUID } from "node:crypto";
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

export async function createRepositoryAnalysis(
  url: string,
) {
  const jobId = crypto.randomUUID();

  const job = await repositoryIngestionQueue.add(
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
    message: "Repository analysis started",
    jobId: job.id,
    url,
    status: "queued",
  };
}

export async function getRepositoryAnalysis(
  jobId: string,
) {
  const job = await Job.fromId(
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

  const state = await job.getState();

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

  const result = job.returnvalue as
    | {
        architectureMap?: ArchitectureMap;
        repositoryTree?: RepositoryTreeNode;
      }
    | undefined;

  return {
    jobId: job.id,
    url: job.data.url,
    status,

    ...(state !== "waiting" && state !== "delayed"
      ? {
          progress: job.progress,
        }
      : {}),

    ...(state === "completed" && result
      ? {
          architectureMap: result.architectureMap,
          repositoryTree: result.repositoryTree,
        }
      : {}),

    ...(state === "failed"
      ? {
          error: job.failedReason,
        }
      : {}),
  };
}

export async function getRepositoryFile(
  repositoryId: string,
  filePath: string,
) {
  const INGESTION_SERVICE_URL =
    process.env.INGESTION_SERVICE_URL ||
    "http://localhost:5001";

  const response = await axios.get(
    `${INGESTION_SERVICE_URL}/internal/repositories/${repositoryId}/files`,
    {
      params: {
        path: filePath,
      },
    },
  );

  return response.data;
}