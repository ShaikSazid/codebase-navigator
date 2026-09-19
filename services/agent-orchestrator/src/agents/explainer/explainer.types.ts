export interface ExplainerInput {
  filePath: string;
  content: string;

  dependencies?: string[];

  repositoryContext?: string;

  language?: string;

  usedBy?: string[];

  symbols?: Array<{
    name: string;
    kind: string;
    startLine: number;
    endLine: number;
    signature?: string;
  }>;
}

export interface FileExplanation {
  filePath: string;
  summary: string;
  responsibilities: string[];
  keyFunctions: Array<{
    name: string;
    explanation: string;
  }>;
  dependencies: string[];
  codeFlow: string;
  repositoryRole: string;
  uncertainty: string[];
}