import { Request, Response, NextFunction } from "express";

import { getRepositoryAnalysis } from "../services/repository.service.js";

export function getRepositoryStatus(req: Request<{jobId: string}>, res: Response, next: NextFunction) {
    try {
        const { jobId } = req.params;
        const job = getRepositoryAnalysis(jobId);
        if(!job) {
            return res.status(404).json({
                message: "Repository analysis job not found"
            });
        }
        return res.status(200).json(job)
    } catch (error) {
        next(error);
    }
}