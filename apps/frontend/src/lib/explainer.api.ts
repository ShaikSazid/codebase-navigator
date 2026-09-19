import api from "./api";

export interface ExplainFileRequest {
  repositoryId: string;
  filePath: string;
  content: string;
  dependencies?: string[];
  repositoryContext?: string;
}

export interface FileExplanation {
  filePath: string;

  fileRole: string;

  whyExists: string;

  responsibilities: string[];

  keyFunctions: Array<{
    name: string;
    explanation: string;
  }>;

  dataFlow: string;

  usedBy: string[];

  keyConcepts: Array<{
    name: string;
    explanation: string;
  }>;

  uncertainty: string[];
}

export interface ExplainFileResponse {
  message: string;
  explanation: FileExplanation;
}

export async function explainFile(
  input: ExplainFileRequest,
): Promise<FileExplanation> {
  const response =
    await api.post<ExplainFileResponse>(
      "/api/explainer",
      input,
    );

  return response.data.explanation;
}