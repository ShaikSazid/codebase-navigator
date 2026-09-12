import type { CodeChunk } from "./chunk.service.js";
import { embedChunk, type EmbeddedCodeChunk } from "./embedded-chunk.service.js";

export async function embedChunks(chunks: CodeChunk[]): Promise<EmbeddedCodeChunk[]> {
    const embeddedChunks: EmbeddedCodeChunk[] = [];
    for (const chunk of chunks) {
        const embeddedChunk = await embedChunk(chunk);
        embeddedChunks.push(embeddedChunk);
    }
    return embeddedChunks;
}