export interface FileNode {
  path: string;
  imports: string[];
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