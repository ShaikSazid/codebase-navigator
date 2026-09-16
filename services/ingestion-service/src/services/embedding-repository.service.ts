import type { CodeChunk } from "./chunk.service.js";
import {
  generateEmbeddings,
} from "./embedding.service.js";
import type { EmbeddedCodeChunk } from "./embedded-chunk.service.js";

const BATCH_SIZE = 20;

export async function embedChunks(
  chunks: CodeChunk[],
  repositoryId: string,
): Promise<EmbeddedCodeChunk[]> {
  const embeddedChunks: EmbeddedCodeChunk[] = [];

  for (
    let start = 0;
    start < chunks.length;
    start += BATCH_SIZE
  ) {
    const batch = chunks.slice(
      start,
      start + BATCH_SIZE,
    );

    const embeddings = await generateEmbeddings(
      batch.map((chunk) => chunk.content),
    );

    for (let i = 0; i < batch.length; i++) {
      embeddedChunks.push({
        ...batch[i],
        embedding: embeddings[i],
        repositoryId,
      });
    }
  }

  return embeddedChunks;
}