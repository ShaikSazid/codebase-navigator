import { Request, Response, NextFunction } from "express";
import { createRepositorySchema } from "../schemas/repository.schema.js";
import { createRepositoryAnalysis } from "../services/repository.service.js";

export function createRepository(req: Request, res: Response, next: NextFunction) {
    try {
        const result = createRepositorySchema.safeParse(req.body);
        if(!result.success) {
            req.log.warn({
                validationErrors: result.error.issues
            },
        "Invalid repository request")
        return res.status(400).json({
            message: "Invalid request",
            errors: result.error.issues
        })
        }
        const { url } = result.data;
        req.log.info({ repositoryUrl: url }, "Repository analysis requested");
        const analysis = createRepositoryAnalysis(url);
        res.status(201).json(analysis);
    } catch (error) {
        next(error);
    }
}