import { repositoryIngestionQueue } from "./ingestion.queue.js";

const job = await repositoryIngestionQueue.add(
  "repository-analysis",
  {
    url: "https://github.com/ShaikSazid/github-pr-risk-analyzer.git",
    repositoryId: "test-repository-123",
  },
);

console.log(
  "Test repository job created:",
  job.id,
);

process.exit(0);