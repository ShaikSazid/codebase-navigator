import { Request, Response, NextFunction } from "express";
import { createRepositorySchema } from "../schemas/repository.schema.js";
import { createRepositoryAnalysis } from "../services/repository.service.js";
import { getRepositoryFile } from "../services/repository.service.js";

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

export async function getRepositoryFileContent(
  req: Request<{ repositoryId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const { repositoryId } = req.params;
    const filePath = req.query.path;

    if (typeof filePath !== "string" || !filePath) {
      return res.status(400).json({
        message: "File path is required",
      });
    }

    const file = await getRepositoryFile(
      repositoryId,
      filePath,
    );

    return res.status(200).json(file);
  } catch (error) {
    next(error);
  }
}