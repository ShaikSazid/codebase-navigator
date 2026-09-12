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
    processRepositoryAnalysis(jobId);
    return {
        message: "Repository analysis started",
        jobId,
        url,
        status: job.status
    };
}

function processRepositoryAnalysis(jobId: string) {
    const job = jobs.get(jobId);
    if(!job) return;
    job.status = "processing";
    logger.info({ jobId, status: job.status }, "Repository analysis processing started");
    setTimeout(() => {
        const currentJob = jobs.get(jobId);
        if(!currentJob) return;
        currentJob.status = "completed";
        logger.info({ jobId, status: job.status }, "Repository analysis completed");
    }, 5000);
}

export function getRepositoryAnalysis(jobId: string) {
    const job = jobs.get(jobId);
    logger.info({ jobId, found: Boolean(job)}, "Repository analysis job lookup");
    return job;
}