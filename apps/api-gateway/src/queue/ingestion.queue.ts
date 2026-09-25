import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const repositoryIngestionQueue = new Queue("repository-ingestion", {
    connection: redisConnection
});