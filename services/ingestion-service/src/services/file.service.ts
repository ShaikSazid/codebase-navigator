import { readdir, readFile } from "fs/promises";
import path from "path";
import { stat } from "fs/promises";

import { shouldIncludeFile } from "./file-filter.service.js";

export interface RepositoryFile {
    path: string;
    content: string;
}

const MAX_FILE_SIZE = 1 * 1024 * 1024;

function isTextContent(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, 1892);
    for(const byte of sample) {
        if(byte === 0) {
            return false;
        }
    }
    return true;
}

export async function readRepositoryFiles(repositoryPath: string): Promise<RepositoryFile[]> {
    const files: RepositoryFile[] = [];
    async function walkDirectory(directory: string): Promise<void> {
        const entries = await readdir(directory, {
            withFileTypes: true
        });
        for(const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            const relativePath = path.relative(repositoryPath, fullPath);
            if(!shouldIncludeFile(relativePath)) {
                continue;
            }
            if(entry.isDirectory()) {
                await walkDirectory(fullPath);
                continue;
            }
            if(entry.isFile()) {
                const fileStats = await stat(fullPath);
                if(fileStats.size > MAX_FILE_SIZE) {
                    continue;
                }
                const buffer = await readFile(fullPath);
                if(!isTextContent(buffer)) {
                    continue;
                }
                const content = buffer.toString("utf-8");
                files.push({
                    path: relativePath,
                    content
                })
            }
        }
    }
    await walkDirectory(repositoryPath);
    return files;
}