import { describe, expect, it } from "vitest";
import { detectStructuralPattern } from "../agents/mapper/mapper.agent.js";

describe("detectStructuralPattern", () => {
  it("should detect a clearly structured repository", () => {
    const result = detectStructuralPattern({
      repositoryIndex: "structured-repository",

      files: [
        {
          path: "src/routes/auth.routes.ts",
          imports: [],
        },
        {
          path: "src/controllers/auth.controller.ts",
          imports: [],
        },
        {
          path: "src/services/auth.service.ts",
          imports: [],
        },
        {
          path: "src/models/user.model.ts",
          imports: [],
        },
      ],

      dependencyEdges: [],
    });

    expect(result).toBe(true);
  });

  it("should detect an unclear repository structure", () => {
    const result = detectStructuralPattern({
      repositoryIndex: "unclear-repository",

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

      dependencyEdges: [],
    });

    expect(result).toBe(false);
  });

  it("should not consider a repository structured from only one signal", () => {
    const result = detectStructuralPattern({
      repositoryIndex: "weakly-structured-repository",

      files: [
        {
          path: "src/services/auth.service.ts",
          imports: [],
        },
        {
          path: "src/random.ts",
          imports: [],
        },
        {
          path: "src/helper.ts",
          imports: [],
        },
      ],

      dependencyEdges: [],
    });

    expect(result).toBe(false);
  });
});