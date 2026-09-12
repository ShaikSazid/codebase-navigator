import { randomUUID } from "crypto";
import type { RepositoryFile } from "./file.service.js";

export interface CodeChunk {
    chunkId: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
}

const CHUNK_SIZE = 80;
const CHUNK_OVERLAP = 20;

export function chunkFile(file: RepositoryFile): CodeChunk[] {
    const lines = file.content.split("\n");
    const chunks: CodeChunk[] = [];
    let start = 0;
    while (start < lines.length) {
        const end = Math.min(start + CHUNK_SIZE, lines.length);
        chunks.push({
            chunkId: randomUUID(),
            filePath: file.path,
            content: lines.slice(start, end).join("\n"),
            startLine: start + 1,
            endLine: end,
        });
        if (end === lines.length) {
            break;
        }
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}