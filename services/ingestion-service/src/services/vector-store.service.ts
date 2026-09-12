import { ChromaClient } from "chromadb";
import type { EmbeddedCodeChunk } from "./embedded-chunk.service.js";

const client = new ChromaClient({
    host: "localhost",
    port: 8080,
    ssl: false 
});

const COLLECTION_NAME = "codebase_chunks";

export async function getCodeCollection() {
    const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME, embeddingFunction: null });
    return collection;
}

export async function storeEmbeddedChunks(chunks: EmbeddedCodeChunk[]): Promise<void> {
    if (chunks.length === 0) {
        return;
    }
    const collection = await getCodeCollection();
    await collection.upsert({
        ids: chunks.map((chunk) => chunk.chunkId),
        embeddings: chunks.map((chunk) => chunk.embedding),
        documents: chunks.map((chunk) => chunk.content),
        metadatas: chunks.map((chunk) => ({
            repositoryId: chunk.repositoryId,
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine
        }))
    });
}