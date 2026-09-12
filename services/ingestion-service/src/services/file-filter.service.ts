import path from "path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vite",
  "__pycache__",
  ".venv",
]);

const IGNORED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".mp3",
  ".mp4",
  ".wav",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".exe",
  ".dll",
]);

export function shouldIncludeFile(filePath: string): boolean {
  const normalizedPath = filePath.split(path.sep);
  const containsIgnoredDirectory = normalizedPath.some((part) =>
    IGNORED_DIRECTORIES.has(part)
  );
  if (containsIgnoredDirectory) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();

  if (IGNORED_EXTENSIONS.has(extension)) {
    return false;
  }
  return true;
}