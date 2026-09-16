import { describe, expect, it } from "vitest";

import { searchCode } from "../services/vector-search.service";

describe("searchCode", () => {
    it("should retrieve code from the requested repository", async () => {
        const results = await searchCode(
            "Where does the user login?",
            "metadata-test-20260913",
            5
        );

        expect(results.length).toBeGreaterThan(0);

        expect(results[0].filePath).toBe("README");
        expect(results[0].startLine).toBe(1);
        expect(results[0].endLine).toBe(2);
        expect(results[0].content).toContain("Hello World!");
    });
});