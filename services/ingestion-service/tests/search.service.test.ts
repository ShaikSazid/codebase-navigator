import { describe, expect, it } from "vitest";

import type { CodeChunk } from "../src/services/chunk.service.js";
import { embedChunks } from "../src/services/embedding-repository.service.js";
import { searchCode } from "../src/services/search.service.js";
import { storeEmbeddedChunks } from "../src/services/vector-store.service.js";

describe("searchCode", () => {
    it("should retrieve the most relevant code for a query", async () => {
        const repositoryId = "search-test-repository";

        const chunks: CodeChunk[] = [
            {
                chunkId: "search-test-auth",
                filePath: "src/auth.ts",
                content: `
                    export function loginUser(
                        email: string,
                        password: string
                    ) {
                        return authenticateUser(email, password);
                    }
                `,
                startLine: 10,
                endLine: 15,
            },
            {
                chunkId: "search-test-payment",
                filePath: "src/payment.ts",
                content: `
                    export function processPayment(amount: number) {
                        return chargeCard(amount);
                    }
                `,
                startLine: 20,
                endLine: 23,
            },
        ];

        const embeddedChunks = await embedChunks(
            chunks,
            repositoryId
        );

        await storeEmbeddedChunks(embeddedChunks);

        const results = await searchCode(
            "Where does the user login and authentication happen?",
            repositoryId,
            2
        );

        expect(results.length).toBeGreaterThan(0);

        expect(results[0].filePath).toBe("src/auth.ts");
    });
    it("should only return chunks from the requested repository", async () => {
        const repositoryA = "repository-a";
        const repositoryB = "repository-b";

        const chunks: CodeChunk[] = [
            {
                chunkId: "isolation-a-auth",
                filePath: "src/auth.ts",
                content: `
                export function authenticateUser(email: string) {
                    return verifyCredentials(email);
                }
            `,
                startLine: 1,
                endLine: 5,
            },
            {
                chunkId: "isolation-b-auth",
                filePath: "src/auth.ts",
                content: `
                export function authenticateUser(email: string) {
                    return checkUserPassword(email);
                }
            `,
                startLine: 1,
                endLine: 5,
            },
        ];

        const embeddedRepositoryA = await embedChunks(
            [chunks[0]],
            repositoryA
        );

        const embeddedRepositoryB = await embedChunks(
            [chunks[1]],
            repositoryB
        );

        await storeEmbeddedChunks(embeddedRepositoryA);
        await storeEmbeddedChunks(embeddedRepositoryB);

        const results = await searchCode(
            "How does user authentication work?",
            repositoryA,
            5
        );

        expect(results.length).toBeGreaterThan(0);

        for (const result of results) {
            expect(result.filePath).toBe("src/auth.ts");
        }

        expect(
            results.every((result) =>
                result.chunkId === "isolation-a-auth"
            )
        ).toBe(true);
    });
});