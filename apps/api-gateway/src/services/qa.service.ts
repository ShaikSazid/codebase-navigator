import axios from "axios";
import logger from "../logger/index.js";

const QA_SERVICE_URL = process.env.QA_SERVICE_URL || "http://localhost:5002";

export async function askQuestion(question: string, repositoryId: string) {
  logger.info({ question, repositoryId }, "Sending question to Q&A service");
  const response = await axios.post(
    `${QA_SERVICE_URL}/api/qa/ask`,
    {
      question,
      repositoryId,
    },
  );
  return response.data;
}