import type {
  DataModel,
} from "../services/code-intelligence/data-model/data-model.types.js";

export interface RepositorySymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  signature?: string;
  routePaths?: string[];
}

export interface RepositoryRelationship {
  source: string;
  target: string;
  kind: string;
  confidence?: number;
  evidence?: {
    filePath: string;
    startLine: number;
    endLine: number;
    mountPath?: string;
  };
}

export interface FileNode {
  path: string;
  imports: string[];
  language?: string;
  symbols?: RepositorySymbol[];
}

export interface DependencyEdge {
  source: string;
  target: string;
}

export interface RepoFileIndex {
  repositoryIndex: string;
  files: FileNode[];
  dependencyEdges: DependencyEdge[];
  relationships: RepositoryRelationship[];
  dataModels?: DataModel[];
}