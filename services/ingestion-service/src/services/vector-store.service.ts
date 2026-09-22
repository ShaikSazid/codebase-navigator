import { QdrantClient } from "@qdrant/js-client-rest";

import type {
  EmbeddedCodeChunk,
} from "./embedded-chunk.service.js";

console.log("QDRANT_URL:", process.env.QDRANT_URL);
console.log(
  "QDRANT_API_KEY loaded:",
  Boolean(process.env.QDRANT_API_KEY),
);

const client = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME =
  "codebase_chunks_384";

const EMBEDDING_DIMENSION =
  384;

export async function getCodeCollection() {
  const exists =
    await client.collectionExists(
      COLLECTION_NAME,
    );

  if (!exists.exists) {
    await client.createCollection(
      COLLECTION_NAME,
      {
        vectors: {
          size: EMBEDDING_DIMENSION,
          distance: "Cosine",
        },
      },
    );
  }

  return COLLECTION_NAME;
}

export async function storeEmbeddedChunks(
  chunks: EmbeddedCodeChunk[],
): Promise<void> {
  if (chunks.length === 0) {
    return;
  }

  for (const chunk of chunks) {
    if (
      chunk.embedding.length !==
      EMBEDDING_DIMENSION
    ) {
      throw new Error(
        `Invalid embedding dimension for chunk ${chunk.chunkId}: expected ${EMBEDDING_DIMENSION}, received ${chunk.embedding.length}`,
      );
    }
  }

  await getCodeCollection();

  await client.upsert(
    COLLECTION_NAME,
    {
      wait: true,

      points: chunks.map((chunk) => ({
        id: chunk.chunkId,

        vector: chunk.embedding,

        payload: {
          repositoryId:
            chunk.repositoryId,

          filePath:
            chunk.filePath,

          startLine:
            chunk.startLine,

          endLine:
            chunk.endLine,

          content:
            chunk.content,
        },
      })),
    },
  );
}