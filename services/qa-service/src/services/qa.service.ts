import { searchCode } from "./vector-search.service.js";
import { generateAnswer } from "./answer.service.js";

export async function answerQuestion(question: string, repositoryId: string): Promise<string> {
  const results = await searchCode(question, repositoryId, 5);
  if (results.length === 0) {
    return "I could not find relevant code in this repository to answer the question.";
  }
  return generateAnswer(question, results);
}