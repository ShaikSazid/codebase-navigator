import api from "./api";

export type RepositoryAnalysisStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface AnalyzeRepositoryResponse {
  message: string;
  jobId: string;
  url: string;
  status: RepositoryAnalysisStatus;
}

export interface ArchitectureLayer {
  name: string;
  description: string;
  files: string[];
}

export interface RepositoryFile {
  path: string;
  content: string;
}

export interface RankedFile {
  path: string;
  importanceScore: number;
  reason: string;
}

export type ArchitectureMap =
  | {
      type: "structured";
      layers: ArchitectureLayer[];
      summary: string;
    }
  | {
      type: "importance-ranked";
      rankedFiles: RankedFile[];
      summary: string;
    };

export interface RepositoryAnalysisJob {
  jobId: string;
  url: string;
  status: RepositoryAnalysisStatus;
  architectureMap?: ArchitectureMap;
  repositoryTree?: RepositoryTreeNode;
}

export async function analyzeRepository(
  repositoryUrl: string,
): Promise<AnalyzeRepositoryResponse> {
  const response =
    await api.post<AnalyzeRepositoryResponse>(
      "/api/repositories",
      {
        url: repositoryUrl,
      },
    );

  return response.data;
}

export async function getRepositoryStatus(
  jobId: string,
): Promise<RepositoryAnalysisJob> {
  const response =
    await api.get<RepositoryAnalysisJob>(
      `/api/repositories/${jobId}`,
    );

  return response.data;
}

export async function getRepositoryFile(
  repositoryId: string,
  filePath: string,
): Promise<RepositoryFile> {
  const response = await api.get(
    `/api/repositories/${repositoryId}/files`,
    {
      params: {
        path: filePath,
      },
    },
  );

  return response.data;
}

export interface RepositoryTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: RepositoryTreeNode[];
}