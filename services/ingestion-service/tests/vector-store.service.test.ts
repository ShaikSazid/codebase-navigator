// import { describe, expect, it } from "vitest";

// import type { CodeChunk } from "../src/services/chunk.service.js";
// import { embedChunks } from "../src/services/embedding-repository.service.js";
// import {
//     getCodeCollection,
//     storeEmbeddedChunks,
// } from "../src/services/vector-store.service.js";

// describe("vector store", () => {
//     it("should connect to Chroma and create the code collection", async () => {
//         const collection = await getCodeCollection();

//         expect(collection.name).toBe("codebase_chunks");
//     });

//     it("should store embedded code chunks in Chroma", async () => {
//         const chunks: CodeChunk[] = [
//             {
//                 chunkId: "storage-test-1",
//                 filePath: "src/auth.ts",
//                 content: "function loginUser() { return true; }",
//                 startLine: 1,
//                 endLine: 1,
//             },
//             {
//                 chunkId: "storage-test-2",
//                 filePath: "src/user.ts",
//                 content: "function getUser() { return {}; }",
//                 startLine: 10,
//                 endLine: 10,
//             },
//         ];

//         const embeddedChunks = await embedChunks(chunks);

//         await storeEmbeddedChunks(embeddedChunks);

//         const collection = await getCodeCollection();

//         const result = await collection.get({
//             ids: ["storage-test-1", "storage-test-2"],
//         });

//         expect(result.ids).toContain("storage-test-1");
//         expect(result.ids).toContain("storage-test-2");

//         expect(result.documents).toContain(
//             "function loginUser() { return true; }"
//         );

//         expect(result.documents).toContain(
//             "function getUser() { return {}; }"
//         );
//     });
// });