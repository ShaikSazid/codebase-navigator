import type { CodeChunk } from "./chunk.service.js";
import { generateEmbeddings } from "./embedding.service.js";
import type { EmbeddedCodeChunk } from "./embedded-chunk.service.js";
import { storeEmbeddedChunks } from "./vector-store.service.js";
import { logMemory } from "../utils/diagnostics.js";

const BATCH_SIZE = 10;

export async function embedAndStoreChunks(
  chunks: CodeChunk[],
  repositoryId: string,
): Promise<number> {
  const validChunks = chunks.filter(
    (chunk) => chunk.content.trim().length > 0,
  );

  let storedCount = 0;

  for (
    let start = 0;
    start < validChunks.length;
    start += BATCH_SIZE
  ) {
    const batch = validChunks.slice(
      start,
      start + BATCH_SIZE,
    );

    console.log(
      `[EMBEDDING] Processing ${start + 1}-${Math.min(
        start + BATCH_SIZE,
        validChunks.length,
      )} of ${validChunks.length}`,
    );

    logMemory(
      `BEFORE BATCH ${start / BATCH_SIZE + 1}`,
    );

    const embeddings = await generateEmbeddings(
      batch.map(
        (chunk) => chunk.content,
      ),
    );

    logMemory(
      `AFTER EMBEDDING BATCH ${
        start / BATCH_SIZE + 1
      }`,
    );

    const embeddedChunks: EmbeddedCodeChunk[] =
      batch.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
        repositoryId,
      }));

    await storeEmbeddedChunks(
      embeddedChunks,
    );

    logMemory(
      `AFTER QDRANT BATCH ${
        start / BATCH_SIZE + 1
      }`,
    );

    storedCount += embeddedChunks.length;
  }

  return storedCount;
}