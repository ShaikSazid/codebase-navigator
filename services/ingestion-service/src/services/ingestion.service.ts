import axios from "axios";

import {
  cloneRepository,
  cleanupRepository,
} from "./repository.service.js";

import {
  readRepositoryFiles,
  type RepositoryFile,
} from "./file.service.js";

import { chunkRepository } from "./chunk-repository.service.js";

import { embedAndStoreChunks } from "./embedding-repository.service.js";

import {
  buildRepositoryIndex,
  getRepositoryFileContext as getIndexedFileContext,
  type RepositoryFileContext,
} from "./repository-index.service.js";

import {
  buildRepositoryTree,
  type RepositoryTreeNode,
} from "./repository-tree.service.js";

import {
  saveRepositoryFiles,
  saveRepositoryTree,
  saveRepositoryIndex,
  saveArchitectureMap,
  saveRepositoryMetadata,
  getRepositoryFile as getStoredRepositoryFile,
  getRepositoryIndex as getStoredRepositoryIndex,
} from "./repository-storage.service.js";

import type { RepoFileIndex } from "../types/repo.js";

interface IngestionResult {
  architectureMap: unknown;
  repositoryTree: RepositoryTreeNode;
}

interface RepositoryIndexingResult {
  files: RepositoryFile[];
  repositoryTree: RepositoryTreeNode;
  repositoryIndex: RepoFileIndex;
}

export interface RepositoryIngestionJobData {
  url: string;
  repositoryId: string;
}

const AGENT_ORCHESTRATOR_URL =
  process.env.AGENT_ORCHESTRATOR_URL ||
  "http://localhost:5003";

export async function indexRepository(
  url: string,
  repositoryId: string,
  repositoryPath: string,
): Promise<RepositoryIndexingResult> {
  const files =
    await readRepositoryFiles(repositoryPath);

  const repositoryName =
    extractRepositoryName(url);

  const repositoryTree =
    buildRepositoryTree(
      files,
      repositoryName,
    );

  console.log(
    `Repository tree built: ${
      repositoryTree.children?.length ?? 0
    } root entries`,
  );

  const repositoryIndex =
    buildRepositoryIndex(
      repositoryId,
      files,
    );

  console.log(
    `Repository index built: ${
      repositoryIndex.files.length
    } files, ${
      repositoryIndex.dependencyEdges.length
    } dependencies`,
  );

  await saveRepositoryFiles(
    repositoryId,
    files,
  );

  await saveRepositoryTree(
    repositoryId,
    repositoryTree,
  );

  await saveRepositoryIndex(
    repositoryId,
    repositoryIndex,
  );

  console.log(
    `Repository Phase 1 data saved to S3: ${repositoryId}`,
  );

  return {
    files,
    repositoryTree,
    repositoryIndex,
  };
}

export async function analyzeArchitecture(
  repositoryId: string,
  repositoryIndex: RepoFileIndex,
): Promise<unknown> {
  const mapperResponse =
    await axios.post(
      `${AGENT_ORCHESTRATOR_URL}/internal/map`,
      {
        repository: repositoryIndex,
      },
    );

  const architectureMap =
    mapperResponse.data.architectureMap;

  await saveArchitectureMap(
    repositoryId,
    architectureMap,
  );

  console.log(
    `Architecture map saved to S3: ${repositoryId}`,
  );

  return architectureMap;
}

export async function generateEmbeddings(
  files: RepositoryFile[],
  repositoryId: string,
): Promise<number> {
  const chunks =
    chunkRepository(files);

  console.log(
    `Repository chunks created: ${chunks.length}`,
  );

  const storedCount =
    await embedAndStoreChunks(
      chunks,
      repositoryId,
    );

  console.log(
    `Repository embeddings stored: ${storedCount}`,
  );

  return storedCount;
}

export async function ingestRepository(
  url: string,
  repositoryId: string,
): Promise<IngestionResult> {
  const repositoryPath =
    await cloneRepository(url);

  try {
    const indexed =
      await indexRepository(
        url,
        repositoryId,
        repositoryPath,
      );

    console.log(
      `Phase 1 completed: repository ${repositoryId} is indexed`,
    );

    const architectureMap =
      await analyzeArchitecture(
        repositoryId,
        indexed.repositoryIndex,
      );

    console.log(
      `Phase 2 completed: architecture generated for ${repositoryId}`,
    );

    try {
      await generateEmbeddings(
        indexed.files,
        repositoryId,
      );

      console.log(
        `Phase 3 completed: embeddings generated for ${repositoryId}`,
      );
    } catch (error) {
      console.error(
        "Repository embedding failed",
        error,
      );
    }

    return {
      architectureMap,
      repositoryTree:
        indexed.repositoryTree,
    };
  } finally {
    await cleanupRepository(
      repositoryPath,
    );
  }
}

export async function getRepositoryIndex(
  repositoryId: string,
): Promise<RepoFileIndex | null> {
  return getStoredRepositoryIndex(
    repositoryId,
  );
}

export async function getRepositoryFile(
  repositoryId: string,
  filePath: string,
): Promise<RepositoryFile | null> {
  return getStoredRepositoryFile(
    repositoryId,
    filePath,
  );
}

export async function getRepositoryFileContext(
  repositoryId: string,
  filePath: string,
): Promise<RepositoryFileContext | null> {
  const repositoryIndex =
    await getStoredRepositoryIndex(
      repositoryId,
    );

  if (!repositoryIndex) {
    return null;
  }

  return getIndexedFileContext(
    repositoryIndex,
    filePath,
  );
}

function extractRepositoryName(
  url: string,
): string {
  const cleanedUrl = url
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  const parts =
    cleanedUrl.split("/");

  return (
    parts[parts.length - 1] ||
    "Repository"
  );
}

export async function processRepositoryIngestion(
  data: RepositoryIngestionJobData,
  onProgress?: (
    progress: number,
  ) => Promise<void> | void,
): Promise<IngestionResult> {
  const {
    url,
    repositoryId,
  } = data;

  const repositoryPath =
    await cloneRepository(url);

  try {
    await saveRepositoryMetadata({
      repositoryId,
      url,
      status: "indexing",
      progress: 10,
      updatedAt:
        new Date().toISOString(),
    });

    await onProgress?.(10);

    const indexed =
      await indexRepository(
        url,
        repositoryId,
        repositoryPath,
      );

    await saveRepositoryMetadata({
      repositoryId,
      url,
      status: "architecture",
      progress: 30,
      updatedAt:
        new Date().toISOString(),
    });

    await onProgress?.(30);

    console.log(
      `Phase 1 completed: repository ${repositoryId} is indexed`,
    );

    const architectureMap =
      await analyzeArchitecture(
        repositoryId,
        indexed.repositoryIndex,
      );

    await saveRepositoryMetadata({
      repositoryId,
      url,
      status: "embedding",
      progress: 60,
      updatedAt:
        new Date().toISOString(),
    });

    await onProgress?.(60);

    console.log(
      `Phase 2 completed: architecture generated for ${repositoryId}`,
    );

    await generateEmbeddings(
      indexed.files,
      repositoryId,
    );

    await saveRepositoryMetadata({
      repositoryId,
      url,
      status: "completed",
      progress: 100,
      updatedAt:
        new Date().toISOString(),
    });

    await onProgress?.(100);

    console.log(
      `Phase 3 completed: embeddings generated for ${repositoryId}`,
    );

    return {
      architectureMap,
      repositoryTree:
        indexed.repositoryTree,
    };
  } catch (error) {
    await saveRepositoryMetadata({
      repositoryId,
      url,
      status: "failed",
      progress: 0,
      updatedAt:
        new Date().toISOString(),
    });

    throw error;
  } finally {
    await cleanupRepository(
      repositoryPath,
    );
  }
}