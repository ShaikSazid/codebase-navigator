import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: generateContentMock,
      };
    },
  };
});

import { runMapperAgent } from "../agents/mapper/mapper.agent.js";

describe("runMapperAgent - importance-ranked fallback", () => {
  beforeEach(() => {
    generateContentMock.mockReset();

    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        type: "importance-ranked",
        rankedFiles: [
          {
            path: "random.ts",
            importanceScore: 0.99,
            reason: "Referenced by several files.",
          },
          {
            path: "helper.ts",
            importanceScore: 0.01,
            reason: "Provides helper functionality.",
          },
          {
            path: "thing.ts",
            importanceScore: 0.5,
            reason: "Contains application logic.",
          },
        ],
        summary: "The repository has no clear architecture.",
      }),
    });
  });

  it("should preserve deterministic scores in the fallback path", async () => {
    const result = await runMapperAgent({
      repository: {
        repositoryIndex: "fallback-test-repository",

        files: [
          {
            path: "random.ts",
            imports: [],
          },
          {
            path: "helper.ts",
            imports: [],
          },
          {
            path: "thing.ts",
            imports: [],
          },
        ],

        dependencyEdges: [
          {
            source: "helper.ts",
            target: "random.ts",
          },
          {
            source: "thing.ts",
            target: "random.ts",
          },
        ],
      },
    });

    expect(result.type).toBe("importance-ranked");

    if (result.type !== "importance-ranked") {
      return;
    }

    expect(result.rankedFiles).toEqual([
      {
        path: "random.ts",
        importanceScore: 1,
        reason: "Referenced by several files.",
      },
      {
        path: "helper.ts",
        importanceScore: 0,
        reason: "Provides helper functionality.",
      },
      {
        path: "thing.ts",
        importanceScore: 0,
        reason: "Contains application logic.",
      },
    ]);

    expect(result.summary).toBe(
      "The repository has no clear architecture.",
    );
  });

  it("should call Gemini exactly once", async () => {
    await runMapperAgent({
      repository: {
        repositoryIndex: "fallback-test-repository",

        files: [
          {
            path: "random.ts",
            imports: [],
          },
          {
            path: "helper.ts",
            imports: [],
          },
          {
            path: "thing.ts",
            imports: [],
          },
        ],

        dependencyEdges: [
          {
            source: "helper.ts",
            target: "random.ts",
          },
        ],
      },
    });

    expect(
      generateContentMock,
    ).toHaveBeenCalledTimes(1);
  });
});