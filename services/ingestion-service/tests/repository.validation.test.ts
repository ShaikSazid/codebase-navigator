import { describe, expect, it } from "vitest";

import {
  isValidGitHubRepositoryUrl,
} from "../src/validation/repository.validation.js";

describe("isValidGitHubRepositoryUrl", () => {
  it("should accept a valid GitHub repository URL", () => {
    expect(
      isValidGitHubRepositoryUrl(
        "https://github.com/facebook/react"
      )
    ).toBe(true);
  });

  it("should reject a non-GitHub URL", () => {
    expect(
      isValidGitHubRepositoryUrl(
        "https://example.com/repository"
      )
    ).toBe(false);
  });

  it("should reject an HTTP URL", () => {
    expect(
      isValidGitHubRepositoryUrl(
        "http://github.com/facebook/react"
      )
    ).toBe(false);
  });

  it("should reject a malformed URL", () => {
    expect(
      isValidGitHubRepositoryUrl("not-a-url")
    ).toBe(false);
  });

  it("should reject a URL without a repository path", () => {
    expect(
      isValidGitHubRepositoryUrl(
        "https://github.com/facebook"
      )
    ).toBe(false);
  });
});