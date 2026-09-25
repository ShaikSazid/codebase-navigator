import "dotenv/config";

import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { processRepositoryIngestion, type RepositoryIngestionJobData } from "../services/ingestion.service.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker<RepositoryIngestionJobData>("repository-ingestion", async (job) => {
  console.log(`[WORKER] processing job ${job.id}`);
  console.log(`[WOrKER] Job data: `, job.data);
  const result = await processRepositoryIngestion(job.data, async (progress) => {
    await job.updateProgress(progress);
    console.log(`[WORKER] Job ${job.id} progress: ${progress}%`);
  });
  console.log(`[WORKER] Job ${job.id} completed`);
  return result;
}, { connection: redisConnection });

worker.on("completed", (job) => {
  console.log(`[WORKER] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[WORKER] Job ${job?.id} failed`,
    err,
  );
});

console.log("[WORKER] Repository ingestion worker started");