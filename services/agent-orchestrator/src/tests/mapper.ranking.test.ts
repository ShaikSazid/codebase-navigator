import { describe, expect, it } from "vitest";
import { rankFilesByImportance } from "../agents/mapper/mapper.agent.js";

describe("rankFilesByImportance", () => {
  it("should rank files based on incoming dependency references", () => {
    const result = rankFilesByImportance({
      repositoryIndex: "ranking-test-repository",

      files: [
        {
          path: "src/app.ts",
          imports: [],
        },
        {
          path: "src/auth.service.ts",
          imports: [],
        },
        {
          path: "src/user.service.ts",
          imports: [],
        },
        {
          path: "src/helper.ts",
          imports: [],
        },
      ],

      dependencyEdges: [
        {
          source: "src/app.ts",
          target: "src/auth.service.ts",
        },
        {
          source: "src/user.service.ts",
          target: "src/auth.service.ts",
        },
        {
          source: "src/helper.ts",
          target: "src/auth.service.ts",
        },
        {
          source: "src/app.ts",
          target: "src/user.service.ts",
        },
      ],
    });

    expect(result).toEqual([
      {
        path: "src/auth.service.ts",
        importanceScore: 1,
      },
      {
        path: "src/user.service.ts",
        importanceScore: 1 / 3,
      },
      {
        path: "src/app.ts",
        importanceScore: 0,
      },
      {
        path: "src/helper.ts",
        importanceScore: 0,
      },
    ]);
  });

  it("should return zero scores when there are no dependencies", () => {
    const result = rankFilesByImportance({
      repositoryIndex: "empty-dependency-repository",

      files: [
        {
          path: "src/a.ts",
          imports: [],
        },
        {
          path: "src/b.ts",
          imports: [],
        },
      ],

      dependencyEdges: [],
    });

    expect(result).toEqual([
      {
        path: "src/a.ts",
        importanceScore: 0,
      },
      {
        path: "src/b.ts",
        importanceScore: 0,
      },
    ]);
  });
});