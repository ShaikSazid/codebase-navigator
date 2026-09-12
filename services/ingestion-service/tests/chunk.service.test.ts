import { describe, expect, it } from "vitest";

import { chunkFile } from "../src/services/chunk.service.js";

describe("chunkFile", () => {
  it("should create chunks from a file", () => {
  const file = {
    path: "src/example.ts",
    content: Array.from(
      { length: 150 },
      (_, index) => `line ${index + 1}`
    ).join("\n"),
  };

  const chunks = chunkFile(file);

  expect(chunks.length).toBe(3);

  expect(chunks[0].startLine).toBe(1);
  expect(chunks[0].endLine).toBe(80);

  expect(chunks[1].startLine).toBe(61);
  expect(chunks[1].endLine).toBe(140);

  expect(chunks[2].startLine).toBe(121);
  expect(chunks[2].endLine).toBe(150);
});

  it("should not create unnecessary chunks for a small file", () => {
    const file = {
      path: "src/example.ts",
      content: "line 1\nline 2\nline 3",
    };

    const chunks = chunkFile(file);

    expect(chunks).toHaveLength(1);

    expect(chunks[0]).toEqual({
      filePath: "src/example.ts",
      content: "line 1\nline 2\nline 3",
      startLine: 1,
      endLine: 3,
    });
  });
});