import { describe, expect, it } from "vitest";

import { shouldIncludeFile } from "../src/services/file-filter.service.js";

describe("shouldIncludeFile", () => {
  it("should include source files", () => {
    expect(shouldIncludeFile("src/index.ts")).toBe(true);
    expect(shouldIncludeFile("src/App.tsx")).toBe(true);
    expect(shouldIncludeFile("server.py")).toBe(true);
  });

  it("should ignore dependency directories", () => {
    expect(
      shouldIncludeFile("node_modules/express/index.js")
    ).toBe(false);

    expect(
      shouldIncludeFile(".git/config")
    ).toBe(false);
  });

  it("should ignore generated directories", () => {
    expect(
      shouldIncludeFile("dist/index.js")
    ).toBe(false);

    expect(
      shouldIncludeFile("coverage/index.html")
    ).toBe(false);
  });

  it("should ignore binary files", () => {
    expect(shouldIncludeFile("assets/logo.png")).toBe(false);
    expect(shouldIncludeFile("archive.zip")).toBe(false);
    expect(shouldIncludeFile("document.pdf")).toBe(false);
  });
});