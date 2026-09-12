import type { CodeChunk } from "./chunk.service.js";
import { generateEmbedding } from "./embedding.service.js";

export interface EmbeddedCodeChunk extends CodeChunk {
    embedding: number[];
}

export async function embedChunk(chunk: CodeChunk): Promise<EmbeddedCodeChunk> {
    const embedding = await generateEmbedding(chunk.content);
    return { ...chunk, embedding };
}