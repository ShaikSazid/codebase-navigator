import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  explainFile,
} from "../services/explainer.service.js";

export async function explainRepositoryFile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      repositoryId,
      filePath,
      content,
      dependencies,
      repositoryContext,
    } = req.body;

    if (
      !repositoryId ||
      !filePath ||
      !content
    ) {
      return res.status(400).json({
        message:
          "repositoryId, filePath and content are required",
      });
    }

    const result = await explainFile({
      repositoryId,
      filePath,
      content,
      dependencies,
      repositoryContext,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}