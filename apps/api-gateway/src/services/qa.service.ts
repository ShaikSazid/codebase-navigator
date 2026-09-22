import axios from "axios";

import logger from "../logger/index.js";

const QA_SERVICE_URL =
  process.env.QA_SERVICE_URL ||
  "http://localhost:5002";

/* -------------------------------------------------------------------------- */
/* Ask                                                                       */
/* -------------------------------------------------------------------------- */

export async function askQuestion(
  question: string,
  repositoryId: string,
) {
  logger.info(
    {
      question,
      repositoryId,
    },
    "Sending question to Q&A service",
  );

  const response =
    await axios.post(
      `${QA_SERVICE_URL}/api/qa/ask`,
      {
        question,
        repositoryId,
      },
    );

  return response.data;
}

/* -------------------------------------------------------------------------- */
/* Navigate                                                                  */
/* -------------------------------------------------------------------------- */

export async function navigateQuestion(
  question: string,
  repositoryId: string,
) {
  logger.info(
    {
      question,
      repositoryId,
    },
    "Sending navigation request to Q&A service",
  );

  const response =
    await axios.post(
      `${QA_SERVICE_URL}/api/qa/navigate`,
      {
        question,
        repositoryId,
      },
    );

  return response.data;
}