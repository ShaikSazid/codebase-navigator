import dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "crypto";
import logger from "../logger/index.js";
import axios from "axios";

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

const jobs = new Map<
  string,
  {
    jobId: string;
    url: string;
    status:
      | "queued"
      | "processing"
      | "completed"
      | "failed";
    architectureMap?: ArchitectureMap;
    repositoryTree?: RepositoryTreeNode;
  }
>();

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL ||
  "http://localhost:5001";

export function createRepositoryAnalysis(
  url: string,
) {
  const jobId = randomUUID();

  const job = {
    jobId,
    url,
    status: "queued" as const,
  };

  jobs.set(jobId, job);

  logger.info(
    {
      jobId,
      repositoryUrl: url,
      status: job.status,
    },
    "Repository analysis job required",
  );

  processRepositoryAnalysis(jobId);

  return {
    message: "Repository analysis started",
    jobId,
    url,
    status: job.status,
  };
}

async function processRepositoryAnalysis(
  jobId: string,
) {
  const job = jobs.get(jobId);

  if (!job) return;

  job.status = "processing";

  logger.info(
    {
      jobId,
      status: job.status,
    },
    "Repository analysis processing started",
  );

  try {
    const response = await axios.post(
      `${INGESTION_SERVICE_URL}/internal/ingest`,
      {
        url: job.url,
        repositoryId: jobId,
      },
    );

    // Store the architecture analysis
    job.architectureMap =
  response.data.architectureMap;

    // Store the repository tree
    job.repositoryTree =
      response.data.repositoryTree;

    job.status = "completed";

    logger.info(
      {
        jobId,
        status: job.status,
      },
      "Repository analysis completed",
    );
  } catch (error) {
    job.status = "failed";

    logger.error(
      {
        jobId,
        error,
        status: job.status,
      },
      "Repository analysis failed",
    );
  }
}

export function getRepositoryAnalysis(
  jobId: string,
) {
  const job = jobs.get(jobId);

  logger.info(
    {
      jobId,
      found: Boolean(job),
    },
    "Repository analysis job lookup",
  );

  return job;
}