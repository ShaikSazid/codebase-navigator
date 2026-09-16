import { describe, expect, it } from "vitest";
import { generateAnswer } from "../services/answer.service.js";
import type { CodeSearchResult } from "../services/vector-search.service.js";

describe("generateAnswer", () => {
  it("should generate an answer using the provided code context", async () => {
    const results: CodeSearchResult[] = [
      {
        chunkId: "test-chunk-1",
        filePath: "src/auth/login.ts",
        content: `
export function login(username: string, password: string) {
  if (username === "admin" && password === "secret") {
    return { authenticated: true };
  }

  return { authenticated: false };
}
        `,
        startLine: 1,
        endLine: 8,
        distance: 0.1,
      },
    ];

    const answer = await generateAnswer(
      "Where does the user login happen?",
      results,
    );

    expect(answer).toBeTruthy();
    expect(answer.toLowerCase()).toContain("src/auth/login.ts");
  });
});