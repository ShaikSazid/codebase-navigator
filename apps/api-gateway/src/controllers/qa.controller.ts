import type {
  Request,
  Response,
} from "express";

import {
  askQuestion,
  navigateQuestion,
} from "../services/qa.service.js";

/* -------------------------------------------------------------------------- */
/* Ask                                                                       */
/* -------------------------------------------------------------------------- */

export async function askRepositoryQuestion(
  req: Request,
  res: Response,
) {
  try {
    const {
      question,
      repositoryId,
    } = req.body;

    if (
      !question ||
      !repositoryId
    ) {
      return res.status(400).json({
        message:
          "question and repositoryId are required",
      });
    }

    const result =
      await askQuestion(
        question,
        repositoryId,
      );

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Q&A request failed",
      error,
    );

    return res.status(500).json({
      message:
        "Failed to answer question",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Navigate                                                                  */
/* -------------------------------------------------------------------------- */

export async function navigateRepositoryQuestion(
  req: Request,
  res: Response,
) {
  try {
    const {
      question,
      repositoryId,
    } = req.body;

    if (
      !question ||
      !repositoryId
    ) {
      return res.status(400).json({
        message:
          "question and repositoryId are required",
      });
    }

    const result =
      await navigateQuestion(
        question,
        repositoryId,
      );

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Repository navigation request failed",
      error,
    );

    return res.status(500).json({
      message:
        "Failed to navigate repository",
    });
  }
}