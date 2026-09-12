import { describe, expect, it } from "vitest";

import { generateEmbedding } from "../src/services/embedding.service.js";

describe("generateEmbedding", () => {
  it("should generate a 768-dimensional embedding", async () => {
    const text = `
      function loginUser(email, password) {
        return authenticateUser(email, password);
      }
    `;

    const embedding = await generateEmbedding(text);

    expect(embedding).toHaveLength(768);
    expect(embedding.every((value) => typeof value === "number")).toBe(
      true
    );
  });
});