export interface RepositorySymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  signature?: string;
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
}