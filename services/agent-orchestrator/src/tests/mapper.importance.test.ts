import { describe, expect, it } from "vitest";
import { countIncomingReferences } from "../agents/mapper/mapper.agent.js";

describe("countIncomingReferences", () => {
  it("should count how many files depend on each file", () => {
    const result = countIncomingReferences([
      {
        source: "src/routes/auth.routes.ts",
        target: "src/services/auth.service.ts",
      },
      {
        source: "src/controllers/auth.controller.ts",
        target: "src/services/auth.service.ts",
      },
      {
        source: "src/routes/user.routes.ts",
        target: "src/services/user.service.ts",
      },
    ]);

    expect(result).toEqual({
      "src/services/auth.service.ts": 2,
      "src/services/user.service.ts": 1,
    });
  });
});