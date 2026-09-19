import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock("@google/genai", () => {
  class GoogleGenAI {
    models = {
      generateContent: generateContentMock,
    };
  }

  return {
    GoogleGenAI,
  };
});

import { runExplainerAgent } from "../src/agents/explainer/explainer.agent.js";

describe("Explainer Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a valid file explanation", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        filePath:
          "src/controllers/repository.controller.ts",

        fileRole:
          "This file acts as an HTTP controller for repository-related operations.",

        whyExists:
          "It keeps HTTP request handling and input validation separate from the repository service logic.",

        responsibilities: [
          "Validate repository creation requests",
          "Start repository analysis jobs",
          "Retrieve repository file contents",
          "Return HTTP responses",
        ],

        keyFunctions: [
          {
            name: "createRepository",
            explanation:
              "Validates the request body, extracts the repository URL, starts an analysis job, and returns the result.",
          },
          {
            name: "getRepositoryFileContent",
            explanation:
              "Validates the requested file path, retrieves the file through the repository service, and returns its contents.",
          },
        ],

        dataFlow:
          "A request enters the controller through an Express route. The controller validates the input, delegates the operation to the repository service, and returns the resulting HTTP response. Errors are passed to the next Express middleware.",

        usedBy: [
          "repository.routes.ts",
        ],

        keyConcepts: [
          {
            name: "Controller layer",
            explanation:
              "The controller handles HTTP requests and delegates business operations to services.",
          },
          {
            name: "Zod validation",
            explanation:
              "The request body is validated using the repository creation schema before analysis begins.",
          },
        ],

        uncertainty: [
          "The implementation details of the repository service are not available in the supplied context.",
        ],
      }),
    });

    const result = await runExplainerAgent({
      filePath:
        "src/controllers/repository.controller.ts",

      content: `
        import { Request, Response, NextFunction } from "express";
        import { createRepositorySchema } from "../schemas/repository.schema.js";
        import { createRepositoryAnalysis } from "../services/repository.service.js";
        import { getRepositoryFile } from "../services/repository.service.js";

        export function createRepository(req: Request, res: Response, next: NextFunction) {
          try {
            const result = createRepositorySchema.safeParse(req.body);

            if (!result.success) {
              return res.status(400).json({
                message: "Invalid request",
              });
            }

            const { url } = result.data;
            const analysis = createRepositoryAnalysis(url);

            res.status(201).json(analysis);
          } catch (error) {
            next(error);
          }
        }

        export async function getRepositoryFileContent(
          req: Request<{ repositoryId: string }>,
          res: Response,
          next: NextFunction,
        ) {
          try {
            const { repositoryId } = req.params;
            const filePath = req.query.path;

            if (typeof filePath !== "string" || !filePath) {
              return res.status(400).json({
                message: "File path is required",
              });
            }

            const file = await getRepositoryFile(
              repositoryId,
              filePath,
            );

            return res.status(200).json(file);
          } catch (error) {
            next(error);
          }
        }
      `,

      dependencies: [
        "../schemas/repository.schema.js",
        "../services/repository.service.js",
      ],

      repositoryContext:
        "This file belongs to the API Gateway controller layer. repository.routes.ts maps HTTP routes to these controller functions.",
    });

    expect(result).toEqual({
      filePath:
        "src/controllers/repository.controller.ts",

      fileRole:
        "This file acts as an HTTP controller for repository-related operations.",

      whyExists:
        "It keeps HTTP request handling and input validation separate from the repository service logic.",

      responsibilities: [
        "Validate repository creation requests",
        "Start repository analysis jobs",
        "Retrieve repository file contents",
        "Return HTTP responses",
      ],

      keyFunctions: [
        {
          name: "createRepository",
          explanation:
            "Validates the request body, extracts the repository URL, starts an analysis job, and returns the result.",
        },
        {
          name: "getRepositoryFileContent",
          explanation:
            "Validates the requested file path, retrieves the file through the repository service, and returns its contents.",
        },
      ],

      dataFlow:
        "A request enters the controller through an Express route. The controller validates the input, delegates the operation to the repository service, and returns the resulting HTTP response. Errors are passed to the next Express middleware.",

      usedBy: [
        "repository.routes.ts",
      ],

      keyConcepts: [
        {
          name: "Controller layer",
          explanation:
            "The controller handles HTTP requests and delegates business operations to services.",
        },
        {
          name: "Zod validation",
          explanation:
            "The request body is validated using the repository creation schema before analysis begins.",
        },
      ],

      uncertainty: [
        "The implementation details of the repository service are not available in the supplied context.",
      ],
    });

    expect(
      generateContentMock,
    ).toHaveBeenCalledTimes(1);
  });

  it("should reject an empty file path", async () => {
    await expect(
      runExplainerAgent({
        filePath: "   ",
        content: "const x = 1;",
      }),
    ).rejects.toThrow(
      "File path is required",
    );

    expect(
      generateContentMock,
    ).not.toHaveBeenCalled();
  });

  it("should reject empty file content", async () => {
    await expect(
      runExplainerAgent({
        filePath: "src/example.ts",
        content: "   ",
      }),
    ).rejects.toThrow(
      "File content is required",
    );

    expect(
      generateContentMock,
    ).not.toHaveBeenCalled();
  });

  it("should reject malformed JSON from Gemini", async () => {
    generateContentMock.mockResolvedValue({
      text: "this is not valid JSON",
    });

    await expect(
      runExplainerAgent({
        filePath: "src/example.ts",
        content:
          "export const value = 1;",
      }),
    ).rejects.toThrow(
      "Explainer agent returned invalid JSON",
    );
  });

  it("should reject a response that does not match the schema", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        filePath: "src/example.ts",
        fileRole: "Example file",
      }),
    });

    await expect(
      runExplainerAgent({
        filePath: "src/example.ts",
        content:
          "export const value = 1;",
      }),
    ).rejects.toThrow(
      "Explainer agent returned invalid schema",
    );
  });

  it("should reject when Gemini returns a different file path", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        filePath: "src/wrong.ts",

        fileRole: "Example file",

        whyExists:
          "Provides an example.",

        responsibilities: [
          "Provide an example",
        ],

        keyFunctions: [],

        dataFlow:
          "The file exports a constant.",

        usedBy: [],

        keyConcepts: [],

        uncertainty: [],
      }),
    });

    await expect(
      runExplainerAgent({
        filePath: "src/example.ts",
        content:
          "export const value = 1;",
      }),
    ).rejects.toThrow(
      "Explainer agent returned an incorrect file path.",
    );
  });
});