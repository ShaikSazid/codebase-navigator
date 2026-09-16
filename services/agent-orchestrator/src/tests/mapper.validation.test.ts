import { describe, expect, it } from "vitest";
import {
  validateArchitectureMapFiles,
} from "../agents/mapper/mapper.validation.js";

const repository = {
  repositoryIndex: "validation-test-repository",

  files: [
    {
      path: "src/routes/auth.ts",
      imports: [],
    },
    {
      path: "src/services/auth.ts",
      imports: [],
    },
    {
      path: "src/app.ts",
      imports: [],
    },
  ],

  dependencyEdges: [],
};

describe("validateArchitectureMapFiles", () => {
  it("should accept files that exist in the repository", () => {
    const result = {
      type: "structured" as const,

      layers: [
        {
          name: "Routes",
          description: "API routes",
          files: ["src/routes/auth.ts"],
        },
        {
          name: "Services",
          description: "Business logic",
          files: ["src/services/auth.ts"],
        },
      ],

      summary: "A structured repository",
    };

    expect(() =>
      validateArchitectureMapFiles(
        result,
        repository,
      ),
    ).not.toThrow();
  });

  it("should reject a structured map containing an unknown file", () => {
    const result = {
      type: "structured" as const,

      layers: [
        {
          name: "Controllers",
          description: "Controller layer",
          files: [
            "src/controllers/auth.controller.ts",
          ],
        },
      ],

      summary: "A structured repository",
    };

    expect(() =>
      validateArchitectureMapFiles(
        result,
        repository,
      ),
    ).toThrow(
      "Mapper agent referenced a file that does not exist: src/controllers/auth.controller.ts",
    );
  });

  it("should accept ranked files that exist in the repository", () => {
    const result = {
      type: "importance-ranked" as const,

      rankedFiles: [
        {
          path: "src/app.ts",
          importanceScore: 1,
          reason: "Application entry point",
        },
        {
          path: "src/services/auth.ts",
          importanceScore: 0.5,
          reason: "Contains authentication logic",
        },
      ],

      summary: "Important files",
    };

    expect(() =>
      validateArchitectureMapFiles(
        result,
        repository,
      ),
    ).not.toThrow();
  });

  it("should reject a ranked result containing an unknown file", () => {
    const result = {
      type: "importance-ranked" as const,

      rankedFiles: [
        {
          path: "src/database/database.ts",
          importanceScore: 1,
          reason: "Database connection",
        },
      ],

      summary: "Important files",
    };

    expect(() =>
      validateArchitectureMapFiles(
        result,
        repository,
      ),
    ).toThrow(
      "Mapper agent referenced a file that does not exist: src/database/database.ts",
    );
  });
});