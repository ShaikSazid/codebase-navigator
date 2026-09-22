import api from "./api";

export interface AskQuestionResponse {
  answer: string;
  repositoryId: string;
  question: string;
}

export interface NavigationStep {
  order: number;
  filePath: string;
  symbol?: string;
  kind?: string;
  startLine: number;
  endLine: number;

  relationshipFromPrevious?: string;

  relationshipEvidence?: {
    filePath: string;
    startLine: number;
    endLine: number;
  };

  explanation: string;
}

export interface NavigationBranch {
  fromOrder: number;
  filePath: string;
  symbol?: string;
  kind?: string;
  startLine: number;
  endLine: number;
  relationship: string;
  explanation: string;
}

export interface NavigationResult {
  question: string;

  entryPoint: NavigationStep | null;

  steps: NavigationStep[];

  branches: NavigationBranch[];

  answer: string;
}

export interface NavigateQuestionResponse {
  navigation: NavigationResult;
  repositoryId: string;
  question: string;
}

export async function askRepositoryQuestion(
  question: string,
  repositoryId: string,
): Promise<AskQuestionResponse> {
  const response =
    await api.post<AskQuestionResponse>(
      "/api/qa/ask",
      {
        question,
        repositoryId,
      },
    );

  return response.data;
}

export async function navigateRepositoryQuestion(
  question: string,
  repositoryId: string,
): Promise<NavigateQuestionResponse> {
  const response =
    await api.post<NavigateQuestionResponse>(
      "/api/qa/navigate",
      {
        question,
        repositoryId,
      },
    );

  return response.data;
}