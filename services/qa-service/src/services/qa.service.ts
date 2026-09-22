import { searchCode } from "./vector-search.service.js";
import { generateAnswer } from "./answer.service.js";
import { getRepositoryIndex } from "./repository-context.service.js";
import {
  navigateRepository,
} from "./navigation.service.js";
import type {
  NavigationResult,
} from "./navigation/navigation.types.js";

export async function answerQuestion(
  question: string,
  repositoryId: string,
): Promise<string> {
  const results =
    await searchCode(
      question,
      repositoryId,
      5,
    );

  if (results.length === 0) {
    return "I could not find relevant code in this repository to answer the question.";
  }

  const repositoryIndex =
    await getRepositoryIndex(
      repositoryId,
    );

  return generateAnswer(
    question,
    results,
    repositoryIndex,
  );
}

export async function navigateQuestion(
  question: string,
  repositoryId: string,
): Promise<NavigationResult> {
  return navigateRepository(
    question,
    repositoryId,
  );
}