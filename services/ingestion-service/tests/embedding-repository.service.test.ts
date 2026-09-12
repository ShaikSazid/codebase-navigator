import { describe, expect, it } from "vitest";

import type { CodeChunk } from "../src/services/chunk.service.js";
import { embedChunks } from "../src/services/embedding-repository.service.js";

describe("embedChunks", () => {
  it("should embed all code chunks", async () => {
    const chunks: CodeChunk[] = [
      {
        chunkId: "chunk-1",
        filePath: "src/auth.ts",
        content: "function login() { return true; }",
        startLine: 1,
        endLine: 1,
      },
      {
        chunkId: "chunk-2",
        filePath: "src/user.ts",
        content: "function getUser() { return {}; }",
        startLine: 1,
        endLine: 1,
      },
    ];

    const results = await embedChunks(chunks);

    expect(results).toHaveLength(2);

    expect(results[0].chunkId).toBe("chunk-1");
    expect(results[1].chunkId).toBe("chunk-2");

    expect(results[0].embedding).toHaveLength(768);
    expect(results[1].embedding).toHaveLength(768);
  });
});