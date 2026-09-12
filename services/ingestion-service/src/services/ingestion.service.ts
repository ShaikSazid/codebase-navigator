import { cloneRepository, cleanupRepository } from "./repository.service.js";
import { readRepositoryFiles } from "./file.service.js";
import { chunkRepository } from "./chunk-repository.service.js";
import { embedChunks } from "./embedding-repository.service.js";
import { storeEmbeddedChunks } from "./vector-store.service.js";

export async function ingestRepository(url: string, repositoryId: string): Promise<void> {
    const repositoryPath = await cloneRepository(url);
    try {
        const files = await readRepositoryFiles(repositoryPath);
        const chunks = chunkRepository(files);
        const embeddedChunks = await embedChunks(chunks, repositoryId);
        await storeEmbeddedChunks(embeddedChunks);
    } finally {
        await cleanupRepository(repositoryPath);
    }
}