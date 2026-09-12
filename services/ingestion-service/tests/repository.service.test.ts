import { describe, expect, it } from "vitest";

import {
  cloneRepository,
  cleanupRepository,
} from "../src/services/repository.service.js";

describe("repository service", () => {
  it("should clone and cleanup a repository", async () => {
    const repositoryUrl = "https://github.com/octocat/Hello-World.git";

    const repositoryPath = await cloneRepository(repositoryUrl);

    expect(repositoryPath).toContain("/tmp/repository-");

    await cleanupRepository(repositoryPath);
  });
  it("should throw an error when cloning fails", async () => {
    const invalidRepositoryUrl =
      "https://github.com/this-repository-definitely-does-not-exist-123456789.git";

    await expect(
      cloneRepository(invalidRepositoryUrl)
    ).rejects.toThrow();
  });
  it("should reject an invalid GitHub repository URL", async () => {
    await expect(
      cloneRepository("https://example.com/repository")
    ).rejects.toThrow("Invalid GitHub repository URL");
  });
});