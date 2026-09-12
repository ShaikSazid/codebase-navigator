import type { CodeChunk } from "./chunk.service.js";
import { generateEmbedding } from "./embedding.service.js";

export interface EmbeddedCodeChunk extends CodeChunk {
    embedding: number[];
    repositoryId: string;
}

export async function embedChunk(chunk: CodeChunk, repositoryId: string): Promise<EmbeddedCodeChunk> {
    const embedding = await generateEmbedding(chunk.content);
    return { ...chunk, embedding, repositoryId };
}