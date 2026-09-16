import { describe, expect, it } from "vitest";
import { buildRepositoryIndex } from "../services/repository-index.service.js";

describe("buildRepositoryIndex", () => {
  it("should extract imports and build dependency edges", () => {
    const index = buildRepositoryIndex("mapper-test-repository", [
      {
        path: "src/routes/auth.routes.ts",
        content: `
import { login } from "../controllers/auth.controller.js";
import express from "express";
        `,
      },
      {
        path: "src/controllers/auth.controller.ts",
        content: `
import { authenticate } from "../services/auth.service.js";
        `,
      },
      {
        path: "src/services/auth.service.ts",
        content: `
export function authenticate() {
  return { authenticated: true };
}
        `,
      },
    ]);

    expect(index.repositoryIndex).toBe("mapper-test-repository");

    expect(index.files).toHaveLength(3);

    expect(index.files[0]).toEqual({
      path: "src/routes/auth.routes.ts",
      imports: [
        "../controllers/auth.controller.js",
        "express",
      ],
    });

    expect(index.files[1]).toEqual({
      path: "src/controllers/auth.controller.ts",
      imports: [
        "../services/auth.service.js",
      ],
    });

    expect(index.files[2]).toEqual({
      path: "src/services/auth.service.ts",
      imports: [],
    });

    expect(index.dependencyEdges).toContainEqual({
      source: "src/routes/auth.routes.ts",
      target: "src/controllers/auth.controller.ts",
    });

    expect(index.dependencyEdges).toContainEqual({
      source: "src/controllers/auth.controller.ts",
      target: "src/services/auth.service.ts",
    });
  });
});