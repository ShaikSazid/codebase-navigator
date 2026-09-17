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

import { embedChunks } from "./embedding-repository.service.js";

import { storeEmbeddedChunks } from "./vector-store.service.js";

import { buildRepositoryIndex } from "./repository-index.service.js";

import {
  buildRepositoryTree,
  type RepositoryTreeNode,
} from "./repository-tree.service.js";

interface IngestionResult {
  architectureMap: unknown;
  repositoryTree: RepositoryTreeNode;
}

/*
 * Temporarily keep repository files in memory.
 *
 * Key:
 *   repositoryId
 *
 * Value:
 *   All files that were read during ingestion.
 *
 * This allows us to retrieve the source code later
 * when the user clicks a file in the repository tree.
 */
const repositoryFiles = new Map<
  string,
  RepositoryFile[]
>();

const AGENT_ORCHESTRATOR_URL =
  process.env.AGENT_ORCHESTRATOR_URL ||
  "http://localhost:5003";

export async function ingestRepository(
  url: string,
  repositoryId: string,
): Promise<IngestionResult> {
  const repositoryPath =
    await cloneRepository(url);

  try {
    const files =
      await readRepositoryFiles(repositoryPath);

    /*
     * Keep the repository files available after
     * the temporary repository is cleaned up.
     */
    repositoryFiles.set(
      repositoryId,
      files,
    );

    // --------------------------------------------------
    // Build repository tree
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Build repository index
    // --------------------------------------------------

    // The Mapper depends on this,
    // not on embeddings.

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

    // --------------------------------------------------
    // Run Mapper
    // --------------------------------------------------

    // Run the Mapper independently
    // of the RAG pipeline.

    const mapperResponse =
      await axios.post(
        `${AGENT_ORCHESTRATOR_URL}/internal/map`,
        {
          repository: repositoryIndex,
        },
      );

    const architectureMap =
      mapperResponse.data.architectureMap;

    // --------------------------------------------------
    // Generate embeddings
    // --------------------------------------------------

    // Embeddings are used only for semantic Q&A.
    //
    // A Gemini quota failure here should not prevent
    // architecture analysis from completing.

    try {
      const chunks =
        chunkRepository(files);

      console.log(
        `Repository chunks created: ${chunks.length}`,
      );

      const embeddedChunks =
        await embedChunks(
          chunks,
          repositoryId,
        );

      await storeEmbeddedChunks(
        embeddedChunks,
      );

      console.log(
        `Repository embeddings stored: ${
          embeddedChunks.length
        }`,
      );
    } catch (error) {
      console.error(
        "Repository embedding failed; continuing with architecture analysis",
        error,
      );
    }

    // --------------------------------------------------
    // Return analysis data
    // --------------------------------------------------

    return {
      architectureMap,
      repositoryTree,
    };
  } finally {
    await cleanupRepository(
      repositoryPath,
    );
  }
}

// --------------------------------------------------
// Retrieve one repository file
// --------------------------------------------------

export function getRepositoryFile(
  repositoryId: string,
  filePath: string,
): RepositoryFile | null {
  const files =
    repositoryFiles.get(repositoryId);

  if (!files) {
    return null;
  }

  return (
    files.find(
      (file) => file.path === filePath,
    ) ?? null
  );
}

// --------------------------------------------------
// Extract repository name from GitHub URL
// --------------------------------------------------

function extractRepositoryName(
  url: string,
): string {
  const cleanedUrl = url
    .replace(/\/$/, "")
    .replace(/\.git$/, "");

  const parts = cleanedUrl.split("/");

  return (
    parts[parts.length - 1] ||
    "Repository"
  );
}