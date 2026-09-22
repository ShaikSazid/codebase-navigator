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
  if (
    !moduleSpecifier.startsWith(".")
  ) {
    return null;
  }

  const importerDirectory =
    path.posix.dirname(
      normalizePath(sourceFile),
    );

  const rawBasePath =
    normalizePath(
      path.posix.join(
        importerDirectory,
        moduleSpecifier,
      ),
    );

  const extension =
    path.posix.extname(
      rawBasePath,
    );

  const sourceExtensions =
    new Set([
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".ts",
      ".tsx",
    ]);

  const basePaths = [
    rawBasePath,
  ];

  if (
    sourceExtensions.has(
      extension,
    )
  ) {
    basePaths.push(
      rawBasePath.slice(
        0,
        -extension.length,
      ),
    );
  }

  for (
    const basePath of basePaths
  ) {
    if (
      fileExists(
        filePaths,
        basePath,
      )
    ) {
      return normalizePath(
        basePath,
      );
    }

    for (
      const candidateExtension
        of JS_EXTENSIONS
    ) {
      const candidate =
        `${basePath}${candidateExtension}`;

      if (
        fileExists(
          filePaths,
          candidate,
        )
      ) {
        return normalizePath(
          candidate,
        );
      }
    }

    for (
      const candidateExtension
        of JS_EXTENSIONS
    ) {
      const candidate =
        `${basePath}/index${candidateExtension}`;

      if (
        fileExists(
          filePaths,
          candidate,
        )
      ) {
        return normalizePath(
          candidate,
        );
      }
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

  const directCandidates = [
    `${cleanedSpecifier}.py`,
    `${cleanedSpecifier}/__init__.py`,
  ];

  for (
    const candidate of directCandidates
  ) {
    if (
      fileExists(
        filePaths,
        candidate,
      )
    ) {
      return candidate;
    }
  }

  const matches =
    [...filePaths].filter(
      (filePath) => {
        const normalized =
          normalizePath(
            filePath,
          );

        return (
          normalized.endsWith(
            `/${cleanedSpecifier}.py`,
          ) ||
          normalized.endsWith(
            `/${cleanedSpecifier}/__init__.py`,
          )
        );
      },
    );

  return matches.length === 1
    ? matches[0] ?? null
    : null;
}

function resolveJavaImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const cleaned =
    moduleSpecifier
      .replace(
        /^import\s+/,
        "",
      )
      .replace(
        /^static\s+/,
        "",
      )
      .replace(
        /;$/,
        "",
      )
      .trim();

  if (!cleaned) {
    return null;
  }

  const expectedPath =
    `${cleaned.replaceAll(".", "/")}.java`;

  if (
    fileExists(
      filePaths,
      expectedPath,
    )
  ) {
    return expectedPath;
  }

  const className =
    cleaned
      .split(".")
      .pop() ??
    cleaned;

  const matches =
    [...filePaths].filter(
      (filePath) =>
        path.posix.basename(
          normalizePath(filePath),
        ) ===
        `${className}.java`,
    );

  return matches.length === 1
    ? matches[0] ?? null
    : null;
}

function resolveGoImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const normalizedSpecifier =
    moduleSpecifier
      .replace(
        /^["']|["']$/g,
        "",
      )
      .trim();

  if (!normalizedSpecifier) {
    return null;
  }

  const packageName =
    normalizedSpecifier
      .split("/")
      .pop();

  if (!packageName) {
    return null;
  }

  const matches =
    [...filePaths].filter(
      (filePath) =>
        path.posix
          .dirname(
            normalizePath(
              filePath,
            ),
          )
          .endsWith(
            `/${packageName}`,
          ),
    );

  return matches.length === 1
    ? matches[0] ?? null
    : matches[0] ?? null;
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
      .replace(
        /^crate::/,
        "",
      )
      .split("::")
      .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const directModule =
    parts.join("/");

  const directCandidates = [
    `${directModule}.rs`,
    `${directModule}/mod.rs`,
  ];

  for (
    const candidate of directCandidates
  ) {
    if (
      fileExists(
        filePaths,
        candidate,
      )
    ) {
      return candidate;
    }
  }

  const parentModule =
    parts
      .slice(0, -1)
      .join("/");

  if (parentModule) {
    const parentCandidates = [
      `${parentModule}.rs`,
      `${parentModule}/mod.rs`,
    ];

    for (
      const candidate
        of parentCandidates
    ) {
      if (
        fileExists(
          filePaths,
          candidate,
        )
      ) {
        return candidate;
      }
    }

    const suffix =
      parentCandidates.filter(
        (candidate) =>
          [...filePaths].some(
            (filePath) =>
              normalizePath(
                filePath,
              ).endsWith(
                `/${candidate}`,
              ),
          ),
      );

    if (suffix.length === 1) {
      const match =
        [...filePaths].find(
          (filePath) =>
            normalizePath(
              filePath,
            ).endsWith(
              `/${suffix[0]}`,
            ),
        );

      if (match) {
        return normalizePath(
          match,
        );
      }
    }
  }

  return null;
}

function resolveCSharpImport(
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const cleaned =
    moduleSpecifier
      .replace(
        /^global::/,
        "",
      )
      .replace(
        /^using\s+/,
        "",
      )
      .replace(
        /;$/,
        "",
      )
      .trim();

  if (!cleaned) {
    return null;
  }

  const directCandidates = [
    `${cleaned.replaceAll(".", "/")}.cs`,
    `${cleaned}.cs`,
  ];

  for (
    const candidate of directCandidates
  ) {
    if (
      fileExists(
        filePaths,
        candidate,
      )
    ) {
      return candidate;
    }
  }

  const name =
    cleaned
      .split(".")
      .pop() ??
    cleaned;

  const matches =
    [...filePaths].filter(
      (filePath) =>
        path.posix.basename(
          normalizePath(filePath),
        ) ===
        `${name}.cs`,
    );

  return matches.length === 1
    ? matches[0] ?? null
    : null;
}

function resolveRubyImport(
  sourceFile: string,
  moduleSpecifier: string,
  filePaths: Set<string>,
): string | null {
  const cleaned =
    moduleSpecifier
      .replace(
        /\.rb$/,
        "",
      );

  if (
    cleaned.startsWith(".")
  ) {
    const directory =
      path.posix.dirname(
        normalizePath(sourceFile),
      );

    const base =
      normalizePath(
        path.posix.join(
          directory,
          cleaned,
        ),
      );

    const candidates = [
      `${base}.rb`,
      `${base}/index.rb`,
    ];

    for (
      const candidate of candidates
    ) {
      if (
        fileExists(
          filePaths,
          candidate,
        )
      ) {
        return candidate;
      }
    }

    return null;
  }

  const name =
    cleaned
      .split("/")
      .pop() ??
    cleaned;

  const matches =
    [...filePaths].filter(
      (filePath) =>
        path.posix.basename(
          normalizePath(filePath),
          ".rb",
        ) === name,
    );

  return matches.length === 1
    ? matches[0] ?? null
    : null;
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

    case "csharp":
      return resolveCSharpImport(
        importInfo.moduleSpecifier,
        filePaths,
      );

    case "ruby":
      return resolveRubyImport(
        sourceFile,
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
    case "ruby":
      return moduleSpecifier.startsWith(
        ".",
      );

    case "python":
      return moduleSpecifier.startsWith(
        ".",
      );

    case "rust":
      return moduleSpecifier.startsWith(
        "crate::",
      );

    default:
      return false;
  }
}

function isDefinitelyExternal(
  language: string,
  moduleSpecifier: string,
): boolean {
  return (
    language === "rust" &&
    (
      moduleSpecifier.startsWith(
        "std::",
      ) ||
      moduleSpecifier.startsWith(
        "core::",
      ) ||
      moduleSpecifier.startsWith(
        "alloc::",
      )
    )
  );
}

export function resolveImports(
  index: CodeIndex,
): ResolvedImport[] {
  const filePaths =
    new Set(
      index.files.map(
        (file) =>
          normalizePath(file.path),
      ),
    );

  const results:
    ResolvedImport[] = [];

  for (
    const file of index.files
  ) {
    for (
      const importInfo of file.imports
    ) {
      const targetFile =
        resolveInternalImport(
          file.path,
          importInfo,
          file.language,
          filePaths,
        );

      if (targetFile) {
        if (
          normalizePath(
            targetFile,
          ) ===
          normalizePath(
            file.path,
          )
        ) {
          continue;
        }

        results.push({
          sourceFile: file.path,
          moduleSpecifier:
            importInfo.moduleSpecifier,
          targetFile:
            normalizePath(
              targetFile,
            ),
          status: "internal",
          confidence: "high",
        });

        continue;
      }

      if (
        isDefinitelyExternal(
          file.language,
          importInfo.moduleSpecifier,
        )
      ) {
        results.push({
          sourceFile: file.path,
          moduleSpecifier:
            importInfo.moduleSpecifier,
          status: "external",
          confidence: "high",
        });

        continue;
      }

      if (
        isDefinitelyInternal(
          file.language,
          importInfo.moduleSpecifier,
        )
      ) {
        results.push({
          sourceFile: file.path,
          moduleSpecifier:
            importInfo.moduleSpecifier,
          status: "unresolved",
          confidence: "low",
        });

        continue;
      }

      results.push({
        sourceFile: file.path,
        moduleSpecifier:
          importInfo.moduleSpecifier,
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
  return resolvedImports
    .filter(
      (resolved) =>
        resolved.status === "internal" &&
        Boolean(
          resolved.targetFile,
        ),
    )
    .map(
      (resolved) => ({
        source:
          resolved.sourceFile,
        target:
          resolved.targetFile!,
        kind: "imports",
      }),
    );
}