import { describe, expect, it } from "vitest";
import { applyDeterministicRanking } from "../agents/mapper/mapper.agent.js";

describe("applyDeterministicRanking", () => {
  it("should preserve deterministic scores and use Gemini reasons", () => {
    const rankedFiles = [
      {
        path: "src/auth.service.ts",
        importanceScore: 1,
      },
      {
        path: "src/user.service.ts",
        importanceScore: 0.33,
      },
      {
        path: "src/helper.ts",
        importanceScore: 0,
      },
    ];

    const generatedFiles = [
      {
        path: "src/auth.service.ts",
        importanceScore: 0.2,
        reason: "Used by several parts of the application.",
      },
      {
        path: "src/user.service.ts",
        importanceScore: 0.9,
        reason: "Handles user-related operations.",
      },
      {
        path: "src/helper.ts",
        importanceScore: 0.8,
        reason: "Provides utility functions.",
      },
    ];

    const result = applyDeterministicRanking(
      rankedFiles,
      generatedFiles,
    );

    expect(result).toEqual([
      {
        path: "src/auth.service.ts",
        importanceScore: 1,
        reason: "Used by several parts of the application.",
      },
      {
        path: "src/user.service.ts",
        importanceScore: 0.33,
        reason: "Handles user-related operations.",
      },
      {
        path: "src/helper.ts",
        importanceScore: 0,
        reason: "Provides utility functions.",
      },
    ]);
  });

  it("should use a fallback reason when Gemini does not provide one", () => {
    const rankedFiles = [
      {
        path: "src/app.ts",
        importanceScore: 1,
      },
    ];

    const generatedFiles: Array<{
      path: string;
      importanceScore: number;
      reason: string;
    }> = [];

    const result = applyDeterministicRanking(
      rankedFiles,
      generatedFiles,
    );

    expect(result).toEqual([
      {
        path: "src/app.ts",
        importanceScore: 1,
        reason:
          "Importance determined from repository dependencies.",
      },
    ]);
  });
});