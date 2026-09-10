import { randomUUID } from "crypto";
import logger from "../logger/index.js";

const jobs = new Map<string, {
    jobId: string,
    url: string,
    status: "queued" | "processing" | "completed" | "failed"
}>();

export function createRepositoryAnalysis(url: string) {
    const jobId = randomUUID();
    const job = { jobId, url, status: "queued" as const}
    jobs.set(jobId, job);
    logger.info({ jobId, repositoryUrl: url, status: job.status }, "Repository analysis job required")
    return {
        message: "Repository analysis started",
        jobId,
        url
    };
}

export function getRepositoryAnalysis(jobId: string) {
    const job = jobs.get(jobId);
    logger.info({ jobId, found: Boolean(job)}, "Repository analysis job lookup");
    return job;
}