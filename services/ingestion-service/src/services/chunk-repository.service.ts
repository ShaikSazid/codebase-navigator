import type { CodeChunk } from "./chunk.service.js";
import { chunkFile } from "./chunk.service.js";
import type { RepositoryFile } from "./file.service.js";

export function chunkRepository(files: RepositoryFile[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    for(const file of files) {
        const fileChunks = chunkFile(file);
        chunks.push(...fileChunks);
    }
    return chunks;
}