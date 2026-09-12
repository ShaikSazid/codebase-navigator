import { describe, expect, it } from "vitest";

import { ingestRepository } from "../src/services/ingestion.service.js";
import { getCodeCollection } from "../src/services/vector-store.service.js";

describe("ingestRepository", () => {
    it("should ingest a GitHub repository and store its code chunks", async () => {
        const repositoryId = "integration-test-repository";

        await ingestRepository(
            "https://github.com/octocat/Hello-World.git",
            repositoryId
        );

        const collection = await getCodeCollection();

        const result = await collection.get({
            where: {
                repositoryId,
            },
        });

        expect(result.ids.length).toBeGreaterThan(0);
        expect(result.documents?.length).toBeGreaterThan(0);
        expect(result.metadatas?.length).toBeGreaterThan(0);
    }, 120_000);
});