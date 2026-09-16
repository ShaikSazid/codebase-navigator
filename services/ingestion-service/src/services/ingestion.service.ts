import axios from "axios";

import {
  cloneRepository,
  cleanupRepository,
} from "./repository.service.js";

import { readRepositoryFiles } from "./file.service.js";

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
      `Repository index built: ${repositoryIndex.files.length} files, ${repositoryIndex.dependencyEdges.length} dependencies`,
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
        `Repository embeddings stored: ${embeddedChunks.length}`,
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