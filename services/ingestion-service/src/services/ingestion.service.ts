import axios from "axios";
import { cloneRepository, cleanupRepository } from "./repository.service.js";
import { readRepositoryFiles, type RepositoryFile } from "./file.service.js";
import { chunkRepository } from "./chunk-repository.service.js";
import { embedAndStoreChunks } from "./embedding-repository.service.js";
import {
  buildRepositoryIndex,
  getRepositoryFileContext as getIndexedFileContext,
  type RepositoryFileContext,
} from "./repository-index.service.js";
import { buildRepositoryTree, type RepositoryTreeNode } from "./repository-tree.service.js";
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

const repositoryFiles = new Map<string, RepositoryFile[]>();
const repositoryIndexes = new Map<string, RepoFileIndex>();

const AGENT_ORCHESTRATOR_URL = process.env.AGENT_ORCHESTRATOR_URL || "http://localhost:5003";

/**
 * Phase 1: Clone the repository, read its files, build the repository tree,
 * and build the structural repository index.
 */
async function indexRepository(
  url: string,
  repositoryId: string,
  repositoryPath: string
): Promise<RepositoryIndexingResult> {
  const files = await readRepositoryFiles(repositoryPath);
  repositoryFiles.set(repositoryId, files);

  const repositoryName = extractRepositoryName(url);
  const repositoryTree = buildRepositoryTree(files, repositoryName);

  console.log(`Repository tree built: ${repositoryTree.children?.length ?? 0} root entries`);

  const repositoryIndex = buildRepositoryIndex(repositoryId, files);
  repositoryIndexes.set(repositoryId, repositoryIndex);

  console.log(
    `Repository index built: ${repositoryIndex.files.length} files, ${repositoryIndex.dependencyEdges.length} dependencies`
  );

  return {
    files,
    repositoryTree,
    repositoryIndex,
  };
}

/**
 * Phase 2: Generate the architecture map from the repository index.
 */
async function analyzeArchitecture(repositoryIndex: RepoFileIndex): Promise<unknown> {
  const mapperResponse = await axios.post(`${AGENT_ORCHESTRATOR_URL}/internal/map`, {
    repository: repositoryIndex,
  });

  return mapperResponse.data.architectureMap;
}

/**
 * Phase 3: Chunk the repository, generate embeddings, and store them in Qdrant.
 */
async function generateEmbeddings(
  files: RepositoryFile[],
  repositoryId: string
): Promise<number> {
  const chunks = chunkRepository(files);
  console.log(`Repository chunks created: ${chunks.length}`);

  const storedCount = await embedAndStoreChunks(chunks, repositoryId);
  console.log(`Repository embeddings stored: ${storedCount}`);

  return storedCount;
}

/**
 * Temporary orchestration function (later replaced by BullMQ jobs).
 */
export async function ingestRepository(
  url: string,
  repositoryId: string
): Promise<IngestionResult> {
  const repositoryPath = await cloneRepository(url);

  try {
    // Phase 1: Repository Indexing
    const indexed = await indexRepository(url, repositoryId, repositoryPath);
    console.log(`Phase 1 completed: repository ${repositoryId} is indexed`);

    // Phase 2: Architecture
    const architectureMap = await analyzeArchitecture(indexed.repositoryIndex);
    console.log(`Phase 2 completed: architecture generated for ${repositoryId}`);

    // Phase 3: Embeddings / RAG
    try {
      await generateEmbeddings(indexed.files, repositoryId);
      console.log(`Phase 3 completed: embeddings generated for ${repositoryId}`);
    } catch (error) {
      console.error("Repository embedding failed", error);
    }

    return {
      architectureMap,
      repositoryTree: indexed.repositoryTree,
    };
  } finally {
    await cleanupRepository(repositoryPath);
  }
}

export function getRepositoryIndex(repositoryId: string): RepoFileIndex | null {
  return repositoryIndexes.get(repositoryId) ?? null;
}

export function getRepositoryFile(
  repositoryId: string,
  filePath: string
): RepositoryFile | null {
  const files = repositoryFiles.get(repositoryId);

  console.log("DEBUG repositoryId:", repositoryId);
  console.log("DEBUG repository exists:", repositoryFiles.has(repositoryId));
  console.log("DEBUG stored repository IDs:", [...repositoryFiles.keys()]);
  console.log("DEBUG requested filePath:", filePath);
  console.log("DEBUG stored file paths:", files?.map((file) => file.path));

  if (!files) {
    return null;
  }

  return files.find((file) => file.path === filePath) ?? null;
}

export function getRepositoryFileContext(
  repositoryId: string,
  filePath: string
): RepositoryFileContext | null {
  const repositoryIndex = repositoryIndexes.get(repositoryId);

  if (!repositoryIndex) {
    return null;
  }

  return getIndexedFileContext(repositoryIndex, filePath);
}

function extractRepositoryName(url: string): string {
  const cleanedUrl = url.replace(/\/+$/, "").replace(/\.git$/, "");
  const parts = cleanedUrl.split("/");

  return parts[parts.length - 1] || "Repository";
}