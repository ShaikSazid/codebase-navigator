import { describe, expect, it } from "vitest";
import { buildRepositoryIndex } from "../services/repository-index.service.js";

describe("repository dependency edges", () => {
  it("should resolve relative imports into dependency edges", () => {
    const index = buildRepositoryIndex("dependency-test-repository", [
      {
        path: "src/routes/auth.routes.ts",
        content: `
import { login } from "../controllers/auth.controller.js";
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
  return true;
}
        `,
      },
    ]);

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