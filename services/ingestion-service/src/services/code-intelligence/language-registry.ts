const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",

  ".ts": "typescript",
  ".tsx": "tsx",

  ".py": "python",

  ".go": "go",

  ".java": "java",

  ".rs": "rust",

  ".cs": "csharp",

  ".rb": "ruby",
};

export function detectLanguage(filePath: string): string | null {
  const lastDot = filePath.lastIndexOf(".");

  if (lastDot === -1) {
    return null;
  }

  const extension = filePath.slice(lastDot).toLowerCase();

  return LANGUAGE_BY_EXTENSION[extension] ?? null;
}