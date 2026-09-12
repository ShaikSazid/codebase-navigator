import { generateEmbedding } from "./embedding.service.js";
import { getCodeCollection } from "./vector-store.service.js";

export interface CodeSearchResult {
    chunkId: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    distance: number;
}

export async function searchCode(query: string, repositoryId: string, limit = 5): Promise<CodeSearchResult[]> {
    const queryEmbedding = await generateEmbedding(query);
    const collection = await getCodeCollection();
    const result = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: { repositoryId },
        include: ["documents", "metadatas", "distances"],
    });
    const documents = result.documents?.[0] ?? [];
    const metadatas = result.metadatas?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];
    const ids = result.ids?.[0] ?? [];
    return documents.map((document, index) => {
        const metadata = metadatas[index];
        return {
            chunkId: ids[index],
            filePath: String(metadata?.filePath ?? ""),
            content: document ?? "",
            startLine: Number(metadata?.startLine ?? 0),
            endLine: Number(metadata?.endLine ?? 0),
            distance: distances[index] ?? 0,
        };
    });
}