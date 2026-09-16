import { describe, expect, it } from "vitest";
import { runMapperAgent } from "../agents/mapper/mapper.agent.js";

describe("runMapperAgent", () => {
  const runGeminiTests = process.env.RUN_GEMINI_TESTS === "true";

  it.skipIf(!runGeminiTests)(
    "should generate a structured architecture map",
    async () => {
      const result = await runMapperAgent({
        repository: {
          repositoryIndex: "mapper-test-repository",

          files: [
            {
              path: "src/routes/auth.routes.ts",
              imports: [
                "../controllers/auth.controller.js",
              ],
            },
            {
              path: "src/controllers/auth.controller.ts",
              imports: [
                "../services/auth.service.js",
              ],
            },
            {
              path: "src/services/auth.service.ts",
              imports: [],
            },
          ],

          dependencyEdges: [
            {
              source: "src/routes/auth.routes.ts",
              target: "src/controllers/auth.controller.ts",
            },
            {
              source: "src/controllers/auth.controller.ts",
              target: "src/services/auth.service.ts",
            },
          ],
        },
      });

      expect(result.summary).toBeTruthy();

      if (result.type === "structured") {
        expect(result.layers).toBeDefined();
        expect(result.layers!.length).toBeGreaterThan(0);
      } else {
        expect(result.rankedFiles).toBeDefined();
        expect(result.rankedFiles!.length).toBeGreaterThan(0);
      }
    },
    30000,
  );
});