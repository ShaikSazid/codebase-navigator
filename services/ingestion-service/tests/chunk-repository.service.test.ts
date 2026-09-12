import { describe, expect, it } from "vitest";

import { chunkRepository } from "../src/services/chunk-repository.service.js";

describe("chunkRepository", () => {
  it("should chunk all repository files", () => {
    const files = [
      {
        path: "src/one.ts",
        content: Array.from(
          { length: 100 },
          (_, index) => `line ${index + 1}`
        ).join("\n"),
      },
      {
        path: "src/two.ts",
        content: "const value = 42;",
      },
    ];

    const chunks = chunkRepository(files);

    expect(chunks).toHaveLength(3);

    expect(
      chunks.filter(
        (chunk) => chunk.filePath === "src/one.ts"
      )
    ).toHaveLength(2);

    expect(
      chunks.filter(
        (chunk) => chunk.filePath === "src/two.ts"
      )
    ).toHaveLength(1);
  });
});