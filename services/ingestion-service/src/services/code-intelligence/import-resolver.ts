import path from "node:path";

import type {
  CodeIndex,
  CodeRelationship,
  NormalizedImport,
} from "./indexer.types.js";

export type ImportResolutionStatus =
  | "internal"
  | "external"
  | "unresolved";

export interface ResolvedImport {
  sourceFile: string;
  moduleSpecifier: string;
  targetFile?: string;
  status: ImportResolutionStatus;
  confidence: "high" | "medium" | "low";
}

const JS_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

function normalizePath(
  filePath: string,
): string {
  return filePath
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function fileExists(
  files: Set<string>,
  filePath: string,
): boolean {
  return files.has(
    normalizePath(filePath),
  );
}

function resolveJavaScriptImport(
  sourceFile: string,
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  if (!moduleSpecifier.startsWith(".")) {
    return null;
  }

  const importerDirectory =
    path.posix.dirname(
      normalizePath(sourceFile),
    );

  const basePath = normalizePath(
    path.posix.join(
      importerDirectory,
      moduleSpecifier,
    ),
  );

  // Exact path.
  if (fileExists(filePaths, basePath)) {
    return basePath;
  }

  // Try normal JavaScript/TypeScript extensions.
  for (const extension of JS_EXTENSIONS) {
    const candidate =
      `${basePath}${extension}`;

    if (fileExists(filePaths, candidate)) {
      return candidate;
    }
  }

  // Try index files.
  for (const extension of JS_EXTENSIONS) {
    const candidate =
      `${basePath}/index${extension}`;

    if (fileExists(filePaths, candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolvePythonImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const cleanedSpecifier =
    moduleSpecifier
      .replace(/^\.+/, "")
      .replaceAll(".", "/");

  if (!cleanedSpecifier) {
    return null;
  }

  /*
   * First try exact repository-root paths.
   *
   * Examples:
   *   services.py
   *   app/services.py
   */
  const directCandidates = [
    `${cleanedSpecifier}.py`,
    `${cleanedSpecifier}/__init__.py`,
  ];

  for (const candidate of directCandidates) {
    if (fileExists(filePaths, candidate)) {
      return candidate;
    }
  }

  /*
   * Only perform suffix-based resolution for
   * qualified module paths.
   *
   * Example:
   *   app.services
   *     ↓
   *   backend/app/services.py
   *
   * We deliberately do NOT do this for:
   *   logging
   *   os
   *   asyncio
   *
   * because these may be standard-library or
   * installed third-party modules.
   */
  if (!cleanedSpecifier.includes("/")) {
    return null;
  }

  for (const filePath of filePaths) {
    const normalizedFile =
      normalizePath(filePath);

    if (
      normalizedFile.endsWith(
        `/${cleanedSpecifier}.py`,
      ) ||
      normalizedFile.endsWith(
        `/${cleanedSpecifier}/__init__.py`,
      )
    ) {
      return normalizedFile;
    }
  }

  return null;
}

function resolveJavaImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const cleanedSpecifier =
    moduleSpecifier
      .replace(/^import\s+/, "")
      .replace(/^static\s+/, "")
      .replace(/;$/, "")
      .trim();

  const expectedPath =
    `${cleanedSpecifier.replaceAll(".", "/")}.java`;

  for (const filePath of filePaths) {
    const normalizedFile =
      normalizePath(filePath);

    if (
      normalizedFile === expectedPath ||
      normalizedFile.endsWith(
        `/${expectedPath}`,
      )
    ) {
      return normalizedFile;
    }
  }

  return null;
}

function resolveGoImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const normalizedSpecifier =
    moduleSpecifier
      .replace(/^["']|["']$/g, "")
      .trim();

  if (!normalizedSpecifier) {
    return null;
  }

  /*
   * Go imports refer to packages rather than
   * individual files.
   *
   * We therefore look for a repository directory
   * whose path corresponds to the imported package.
   */
  const packageTail =
    normalizedSpecifier
      .split("/")
      .slice(-2)
      .join("/");

  for (const filePath of filePaths) {
    const normalizedFile =
      normalizePath(filePath);

    const directory =
      path.posix.dirname(normalizedFile);

    if (
      directory.endsWith(
        `/${packageTail}`,
      )
    ) {
      return normalizedFile;
    }
  }

  return null;
}

function resolveRustImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  if (
    !moduleSpecifier.startsWith(
      "crate::",
    )
  ) {
    return null;
  }

  const parts =
    moduleSpecifier
      .replace(/^crate::/, "")
      .split("::")
      .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const fullModulePath =
    parts.join("/");

  const directCandidates = [
    `${fullModulePath}.rs`,
    `${fullModulePath}/mod.rs`,
  ];

  for (const candidate of directCandidates) {
    if (fileExists(filePaths, candidate)) {
      return candidate;
    }
  }

  /*
   * The last segment may be a symbol rather than
   * a module. Try resolving the parent module.
   */
  if (parts.length > 1) {
    const parentModulePath =
      parts
        .slice(0, -1)
        .join("/");

    const parentCandidates = [
      `${parentModulePath}.rs`,
      `${parentModulePath}/mod.rs`,
    ];

    for (const candidate of parentCandidates) {
      if (fileExists(filePaths, candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveInternalImport(
  sourceFile: string,
  importInfo: NormalizedImport,
  language: string,
  filePaths: Set<string>,
): string | null {
  switch (language) {
    case "javascript":
    case "typescript":
    case "tsx":
      return resolveJavaScriptImport(
        sourceFile,
        importInfo.moduleSpecifier,
        filePaths,
      );

    case "python":
      return resolvePythonImport(
        importInfo.moduleSpecifier,
        filePaths,
      );

    case "java":
      return resolveJavaImport(
        importInfo.moduleSpecifier,
        filePaths,
      );

    case "go":
      return resolveGoImport(
        importInfo.moduleSpecifier,
        filePaths,
      );

    case "rust":
      return resolveRustImport(
        importInfo.moduleSpecifier,
        filePaths,
      );

    default:
      return null;
  }
}

function isDefinitelyInternal(
  language: string,
  moduleSpecifier: string,
): boolean {
  switch (language) {
    case "javascript":
    case "typescript":
    case "tsx":
      return moduleSpecifier.startsWith(".");

    case "rust":
      return moduleSpecifier.startsWith("crate::");

    default:
      return false;
  }
}

function isDefinitelyExternal(
  language: string,
  moduleSpecifier: string,
): boolean {
  switch (language) {
    case "rust":
      return (
        moduleSpecifier.startsWith("std::") ||
        moduleSpecifier.startsWith("core::") ||
        moduleSpecifier.startsWith("alloc::")
      );

    default:
      return false;
  }
}

export function resolveImports(
  index: CodeIndex,
): ResolvedImport[] {
  const filePaths = new Set(
    index.files.map(
      (file) =>
        normalizePath(file.path),
    ),
  );

  const results: ResolvedImport[] = [];

  for (const file of index.files) {
    for (const importInfo of file.imports) {
      const moduleSpecifier =
        importInfo.moduleSpecifier;

      /*
       * First attempt repository resolution.
       *
       * This is important for languages such as
       * Python and Java where an import may be
       * internal even though it isn't relative.
       */
      const targetFile =
        resolveInternalImport(
          file.path,
          importInfo,
          file.language,
          filePaths,
        );

      if (targetFile) {
  /*
   * Never create a self-dependency.
   *
   * This can happen when a module resolver maps
   * an import back to the file currently being
   * analyzed.
   */
  if (normalizePath(targetFile) === normalizePath(file.path)) {
    continue;
  }

  results.push({
    sourceFile: file.path,
    moduleSpecifier,
    targetFile,
    status: "internal",
    confidence: "high",
  });

  continue;
}

      /*
       * Some languages have syntax that lets us
       * confidently identify imports as external.
       */
      if (
        isDefinitelyExternal(
          file.language,
          moduleSpecifier,
        )
      ) {
        results.push({
          sourceFile: file.path,
          moduleSpecifier,
          status: "external",
          confidence: "high",
        });

        continue;
      }

      /*
       * JavaScript / TypeScript relative imports
       * are definitely intended to reference the
       * repository. If resolution failed, mark them
       * unresolved instead of external.
       */
      if (
        isDefinitelyInternal(
          file.language,
          moduleSpecifier,
        )
      ) {
        results.push({
          sourceFile: file.path,
          moduleSpecifier,
          status: "unresolved",
          confidence: "low",
        });

        continue;
      }

      /*
       * For languages where imports can refer either
       * to local packages or external dependencies,
       * failure to resolve means external for now.
       *
       * Later, project metadata such as package
       * manifests and build files will improve this.
       */
      results.push({
        sourceFile: file.path,
        moduleSpecifier,
        status: "external",
        confidence: "medium",
      });
    }
  }

  return results;
}

export function buildResolvedRelationships(
  resolvedImports: ResolvedImport[],
): CodeRelationship[] {
  const relationships: CodeRelationship[] = [];

  for (const resolved of resolvedImports) {
    if (
      resolved.status !== "internal" ||
      !resolved.targetFile
    ) {
      continue;
    }

    relationships.push({
      source: resolved.sourceFile,
      target: resolved.targetFile,
      kind: "imports",
    });
  }

  return relationships;
}