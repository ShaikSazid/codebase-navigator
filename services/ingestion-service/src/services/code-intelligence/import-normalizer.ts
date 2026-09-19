import type {
  NormalizedImport,
} from "./indexer.types.js";

interface RawSpan {
  startLine?: number;
  endLine?: number;
}

interface RawImport {
  source?: string;
  items?: string[];
  alias?: string;
  isWildcard?: boolean;
  span?: RawSpan;
}

function isRawImport(
  value: unknown,
): value is RawImport {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function cleanJavaScriptModuleSpecifier(
  source: string,
): string | null {
  const fromMatch = source.match(
    /\bfrom\s+["']([^"']+)["']/,
  );

  if (fromMatch?.[1]) {
    return fromMatch[1];
  }

  const sideEffectMatch = source.match(
    /^\s*import\s+["']([^"']+)["']/,
  );

  return sideEffectMatch?.[1] ?? null;
}

function normalizeJavaScriptImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const moduleSpecifier =
    cleanJavaScriptModuleSpecifier(
      importInfo.source,
    );

  if (!moduleSpecifier) {
    return null;
  }

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames: importInfo.items ?? [],
    alias: importInfo.alias,
    isWildcard: importInfo.isWildcard ?? false,
    startLine: importInfo.span?.startLine,
    endLine: importInfo.span?.endLine,
  };
}

function normalizePythonImport(
  importInfo: RawImport,
): NormalizedImport[] {
  if (!importInfo.source) {
    return [];
  }

  /*
   * Tree-sitter can return multiline Python imports
   * as a single source string.
   *
   * Normalize whitespace first so both:
   *
   * from app.services import UserService
   *
   * and:
   *
   * from app.services import (
   *     UserService,
   *     OtherService,
   * )
   *
   * are handled consistently.
   */
  const source = importInfo.source
    .replace(/\s+/g, " ")
    .trim();

  if (source.startsWith("from ")) {
    const match = source.match(
      /^from\s+(.+?)\s+import\s+(.+)$/,
    );

    if (!match) {
      return [];
    }

    const moduleSpecifier =
      match[1].trim();

    const importedPart =
      match[2]
        .replace(/[()]/g, "")
        .trim();

    const importedNames =
      importInfo.items &&
      importInfo.items.length > 0
        ? importInfo.items
        : importedPart
            .split(",")
            .map((item) => {
              const cleaned =
                item.trim();

              const aliasIndex =
                cleaned.indexOf(" as ");

              if (aliasIndex !== -1) {
                return cleaned
                  .slice(0, aliasIndex)
                  .trim();
              }

              return cleaned;
            })
            .filter(Boolean);

    return [
      {
        raw: importInfo.source,
        moduleSpecifier,
        importedNames,
        alias: importInfo.alias,
        isWildcard:
          importInfo.isWildcard ??
          importedNames.includes("*"),
        startLine:
          importInfo.span?.startLine,
        endLine:
          importInfo.span?.endLine,
      },
    ];
  }

  if (source.startsWith("import ")) {
    const importedPart = source
      .slice("import ".length)
      .trim();

    const modules = importedPart
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return modules.map((modulePart) => {
      const aliasMatch = modulePart.match(
        /^(.+?)\s+as\s+(.+)$/,
      );

      const moduleSpecifier =
        aliasMatch?.[1]?.trim() ??
        modulePart;

      const alias =
        aliasMatch?.[2]?.trim();

      return {
        raw: importInfo.source!,
        moduleSpecifier,
        importedNames: [],
        alias,
        isWildcard: false,
        startLine:
          importInfo.span?.startLine,
        endLine:
          importInfo.span?.endLine,
      };
    });
  }

  return [];
}

function normalizeGoImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const moduleSpecifier =
    importInfo.source
      .trim()
      .replace(/^["']|["']$/g, "");

  if (!moduleSpecifier) {
    return null;
  }

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames: [],
    alias: importInfo.alias,
    isWildcard: false,
    startLine: importInfo.span?.startLine,
    endLine: importInfo.span?.endLine,
  };
}

function normalizeJavaImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const moduleSpecifier =
    importInfo.source
      .trim()
      .replace(/^import\s+/, "")
      .replace(/^static\s+/, "")
      .replace(/;$/, "")
      .trim();

  if (!moduleSpecifier) {
    return null;
  }

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames: [],
    alias: importInfo.alias,
    isWildcard:
      moduleSpecifier.endsWith(".*"),
    startLine: importInfo.span?.startLine,
    endLine: importInfo.span?.endLine,
  };
}

function normalizeRustImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const moduleSpecifier =
    importInfo.source
      .trim()
      .replace(/^use\s+/, "")
      .replace(/;$/, "")
      .trim();

  if (!moduleSpecifier) {
    return null;
  }

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames: importInfo.items ?? [],
    alias: importInfo.alias,
    isWildcard:
      importInfo.isWildcard ??
      moduleSpecifier.includes("*"),
    startLine: importInfo.span?.startLine,
    endLine: importInfo.span?.endLine,
  };
}

export function normalizeImports(
  language: string,
  rawImports: unknown[],
): NormalizedImport[] {
  const imports = rawImports.filter(
    isRawImport,
  );

  const normalized: NormalizedImport[] = [];

  for (const importInfo of imports) {
    switch (language) {
      case "javascript":
      case "typescript":
      case "tsx": {
        const result =
          normalizeJavaScriptImport(
            importInfo,
          );

        if (result) {
          normalized.push(result);
        }

        break;
      }

      case "python": {
        normalized.push(
          ...normalizePythonImport(
            importInfo,
          ),
        );

        break;
      }

      case "go": {
        const result =
          normalizeGoImport(
            importInfo,
          );

        if (result) {
          normalized.push(result);
        }

        break;
      }

      case "java": {
        const result =
          normalizeJavaImport(
            importInfo,
          );

        if (result) {
          normalized.push(result);
        }

        break;
      }

      case "rust": {
        const result =
          normalizeRustImport(
            importInfo,
          );

        if (result) {
          normalized.push(result);
        }

        break;
      }

      default:
        // Languages for which the current
        // parser output does not expose
        // imports are intentionally ignored.
        break;
    }
  }

  return normalized;
}