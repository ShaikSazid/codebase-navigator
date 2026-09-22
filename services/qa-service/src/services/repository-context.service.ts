interface RepositorySymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  signature?: string;
  routePaths?: string[];
}

interface RepositoryFile {
  path: string;
  imports: string[];
  language?: string;
  symbols?: RepositorySymbol[];
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

interface DataModelField {
  name: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
  nullable?: boolean;
  array?: boolean;
  defaultValue?: string;
  references?: string;
  startLine?: number;
  endLine?: number;
}

interface DataModel {
  id: string;
  name: string;
  filePath: string;
  framework?: string;
  tableName?: string;
  collectionName?: string;
  fields: DataModelField[];
  startLine: number;
  endLine: number;
  symbolId?: string;
}

export interface RepositoryIndex {
  repositoryIndex: string;
  files: RepositoryFile[];
  dependencyEdges: Array<{
    source: string;
    target: string;
  }>;
  relationships: RepositoryRelationship[];
  dataModels?: DataModel[];
}

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL ??
  "http://localhost:5001";

export async function getRepositoryIndex(
  repositoryId: string,
): Promise<RepositoryIndex | null> {
  const response =
    await fetch(
      `${INGESTION_SERVICE_URL}/internal/repository-index/${repositoryId}`,
    );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repository index: ${response.status}`,
    );
  }

  const data =
    (await response.json()) as {
      repositoryIndex: RepositoryIndex;
    };

  return data.repositoryIndex;
}