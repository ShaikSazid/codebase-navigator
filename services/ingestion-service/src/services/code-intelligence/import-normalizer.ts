import type {
  ImportBinding,
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
  bindings?: Array<{
    importedName: string;
    localName: string;
  }>;
}

function isRawImport(
  value: unknown,
): value is RawImport {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function getSpan(
  importInfo: RawImport,
) {
  return {
    startLine:
      importInfo.span?.startLine,
    endLine:
      importInfo.span?.endLine,
  };
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

  const sideEffectMatch =
    source.match(
      /^\s*import\s+["']([^"']+)["']/,
    );

  return (
    sideEffectMatch?.[1] ??
    null
  );
}

function extractJavaScriptBindings(
  source: string,
  importedNames: string[],
  alias?: string,
  isWildcard = false,
): ImportBinding[] {
  const fromMatch = source.match(
    /\bfrom\s+["'][^"']+["']/,
  );

  if (
    !fromMatch ||
    fromMatch.index === undefined
  ) {
    return [];
  }

  const importClause = source
    .slice(0, fromMatch.index)
    .replace(
      /^\s*import\s+/,
      "",
    )
    .trim();

  if (!importClause) {
    return [];
  }

  const bindings: ImportBinding[] =
    [];

  const namespaceMatch =
    importClause.match(
      /^\*\s+as\s+([A-Za-z_$][\w$]*)$/,
    );

  if (namespaceMatch?.[1]) {
    return [
      {
        importedName: "*",
        localName:
          namespaceMatch[1],
      },
    ];
  }

  const namedMatch =
    importClause.match(
      /\{([\s\S]*)\}/,
    );

  if (namedMatch?.[1]) {
    for (
      const rawItem of
        namedMatch[1].split(",")
    ) {
      const item = rawItem
        .trim()
        .replace(
          /^type\s+/,
          "",
        );

      if (!item) {
        continue;
      }

      const aliasMatch =
        item.match(
          /^(.+?)\s+as\s+(.+)$/,
        );

      if (
        aliasMatch?.[1] &&
        aliasMatch[2]
      ) {
        bindings.push({
          importedName:
            aliasMatch[1].trim(),
          localName:
            aliasMatch[2].trim(),
        });
      } else {
        bindings.push({
          importedName: item,
          localName: item,
        });
      }
    }
  }

  const beforeNamed =
    importClause
      .split("{")[0]
      ?.trim();

  if (beforeNamed) {
    const defaultPart =
      beforeNamed
        .split(",")[0]
        ?.trim();

    if (
      defaultPart &&
      !defaultPart.startsWith("*") &&
      !defaultPart.startsWith("{")
    ) {
      bindings.unshift({
        importedName: "default",
        localName: defaultPart,
      });
    }
  }

  if (
    bindings.length === 0 &&
    importedNames.length > 0
  ) {
    for (
      const name of importedNames
    ) {
      bindings.push({
        importedName: name,
        localName: name,
      });
    }
  }

  if (
    bindings.length === 0 &&
    alias &&
    isWildcard
  ) {
    bindings.push({
      importedName: "*",
      localName: alias,
    });
  }

  return bindings;
}

function normalizeJavaScriptImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const requireMatch =
    importInfo.source.match(
      /require\s*\(\s*["']([^"']+)["']\s*\)/,
    );

  if (requireMatch?.[1]) {
    const moduleSpecifier =
      requireMatch[1];

    return {
      raw: importInfo.source,
      moduleSpecifier,
      importedNames:
        importInfo.items ?? [],
      alias:
        importInfo.alias,
      isWildcard: false,
      bindings:
        importInfo.bindings ?? [],
      startLine:
        importInfo.span?.startLine,
      endLine:
        importInfo.span?.endLine,
    };
  }

  const moduleSpecifier =
    cleanJavaScriptModuleSpecifier(
      importInfo.source,
    );

  if (!moduleSpecifier) {
    return null;
  }

  const bindings =
    importInfo.bindings ?? [];

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames:
      importInfo.items ?? [],
    alias:
      importInfo.alias,
    isWildcard:
      importInfo.isWildcard ?? false,
    bindings,
    startLine:
      importInfo.span?.startLine,
    endLine:
      importInfo.span?.endLine,
  };
}

function parsePythonBindings(
  importedPart: string,
): ImportBinding[] {
  const bindings: ImportBinding[] =
    [];

  for (
    const rawItem of importedPart
      .replace(/[()]/g, "")
      .split(",")
  ) {
    const item =
      rawItem.trim();

    if (!item) {
      continue;
    }

    const aliasMatch =
      item.match(
        /^(.+?)\s+as\s+(.+)$/,
      );

    if (
      aliasMatch?.[1] &&
      aliasMatch[2]
    ) {
      bindings.push({
        importedName:
          aliasMatch[1].trim(),
        localName:
          aliasMatch[2].trim(),
      });
    } else {
      bindings.push({
        importedName: item,
        localName: item,
      });
    }
  }

  return bindings;
}

function normalizePythonImport(
  importInfo: RawImport,
): NormalizedImport[] {
  if (!importInfo.source) {
    return [];
  }

  const source =
    importInfo.source
      .replace(/\s+/g, " ")
      .trim();

  if (source.startsWith("from ")) {
    const match =
      source.match(
        /^from\s+(.+?)\s+import\s+(.+)$/,
      );

    if (
      !match?.[1] ||
      !match[2]
    ) {
      return [];
    }

    const bindings =
      parsePythonBindings(
        match[2].trim(),
      );

    return [
      {
        raw: importInfo.source,
        moduleSpecifier:
          match[1].trim(),
        importedNames:
          bindings.map(
            (binding) =>
              binding.importedName,
          ),
        alias: importInfo.alias,
        isWildcard:
          importInfo.isWildcard ??
          match[2].trim() === "*",
        bindings,
        ...getSpan(importInfo),
      },
    ];
  }

  if (source.startsWith("import ")) {
    const modules =
      source
        .slice("import ".length)
        .trim()
        .split(",")
        .map(
          (item) => item.trim(),
        )
        .filter(Boolean);

    return modules.map(
      (modulePart) => {
        const aliasMatch =
          modulePart.match(
            /^(.+?)\s+as\s+(.+)$/,
          );

        const moduleSpecifier =
          aliasMatch?.[1]?.trim() ??
          modulePart;

        const localName =
          aliasMatch?.[2]?.trim() ??
          moduleSpecifier
            .split(".")
            .pop() ??
          moduleSpecifier;

        return {
          raw: importInfo.source!,
          moduleSpecifier,
          importedNames: [],
          alias: localName,
          isWildcard: true,
          bindings: [
            {
              importedName: "*",
              localName,
            },
          ],
          ...getSpan(importInfo),
        };
      },
    );
  }

  return [];
}

function normalizeGoImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const source =
    importInfo.source.trim();

  const match =
    source.match(
      /^(?:(\w+)\s+)?["']([^"']+)["']$/,
    );

  const moduleSpecifier =
    match?.[2] ??
    source
      .replace(
        /^import\s+/,
        "",
      )
      .replace(
        /^["']|["']$/g,
        "",
      )
      .trim();

  if (!moduleSpecifier) {
    return null;
  }

  const localName =
    match?.[1] ??
    moduleSpecifier
      .split("/")
      .pop() ??
    moduleSpecifier;

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames: [],
    alias: localName,
    isWildcard: true,
    bindings: [
      {
        importedName: "*",
        localName,
      },
    ],
    ...getSpan(importInfo),
  };
}

function normalizeJavaImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const source =
    importInfo.source
      .trim()
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

  if (!source) {
    return null;
  }

  const parts =
    source.split(".");

  const importedName =
    parts.pop() ?? source;

  return {
    raw: importInfo.source,
    moduleSpecifier: source,
    importedNames: [
      importedName,
    ],
    alias: importedName,
    isWildcard:
      importedName === "*",
    bindings: [
      {
        importedName,
        localName: importedName,
      },
    ],
    ...getSpan(importInfo),
  };
}

function normalizeRustImport(
  importInfo: RawImport,
): NormalizedImport | null {
  if (!importInfo.source) {
    return null;
  }

  const source =
    importInfo.source
      .trim()
      .replace(
        /^use\s+/,
        "",
      )
      .replace(
        /;$/,
        "",
      )
      .trim();

  if (!source) {
    return null;
  }

  const aliasMatch =
    source.match(
      /(.+?)\s+as\s+(.+)$/,
    );

  const moduleSpecifier =
    aliasMatch?.[1]?.trim() ??
    source;

  const pathParts =
    moduleSpecifier
      .split("::")
      .filter(Boolean);

  const importedName =
    pathParts.pop() ??
    moduleSpecifier;

  const localName =
    aliasMatch?.[2]?.trim() ??
    importedName;

  return {
    raw: importInfo.source,
    moduleSpecifier,
    importedNames: [
      importedName,
    ],
    alias: localName,
    isWildcard:
      importedName === "*",
    bindings: [
      {
        importedName:
          importedName === "*"
            ? "*"
            : importedName,
        localName,
      },
    ],
    ...getSpan(importInfo),
  };
}

function extractCSharpImports(
  source: string,
): NormalizedImport[] {
  const imports: NormalizedImport[] =
    [];

  const pattern =
    /^\s*using\s+(?:static\s+)?([^;=]+?)(?:\s*=\s*([^;]+))?\s*;/gm;

  for (
    const match of source.matchAll(
      pattern,
    )
  ) {
    const moduleSpecifier =
      match[1]?.trim();

    if (!moduleSpecifier) {
      continue;
    }

    const alias =
      match[2]?.trim() ??
      moduleSpecifier
        .split(".")
        .pop() ??
      moduleSpecifier;

    imports.push({
      raw: match[0].trim(),
      moduleSpecifier,
      importedNames: [],
      alias,
      isWildcard: true,
      bindings: [
        {
          importedName: "*",
          localName: alias,
        },
      ],
    });
  }

  return imports;
}

function extractRubyImports(
  source: string,
): NormalizedImport[] {
  const imports: NormalizedImport[] =
    [];

  const pattern =
    /^\s*(?:require_relative|require)\s+["']([^"']+)["']/gm;

  for (
    const match of source.matchAll(
      pattern,
    )
  ) {
    const moduleSpecifier =
      match[1]?.trim();

    if (!moduleSpecifier) {
      continue;
    }

    imports.push({
      raw: match[0].trim(),
      moduleSpecifier,
      importedNames: [],
      isWildcard: true,
      bindings: [
        {
          importedName: "*",
          localName: "",
        },
      ],
    });
  }

  return imports;
}

export function normalizeImports(
  language: string,
  rawImports: unknown[],
  source?: string,
): NormalizedImport[] {
  const imports =
    rawImports.filter(
      isRawImport,
    );

  const normalized:
    NormalizedImport[] = [];

  for (
    const importInfo of imports
  ) {
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

      case "python":
        normalized.push(
          ...normalizePythonImport(
            importInfo,
          ),
        );
        break;

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

      case "csharp":
        break;

      case "ruby":
        break;

      default:
        break;
    }
  }

  if (
    source &&
    language === "csharp" &&
    normalized.length === 0
  ) {
    normalized.push(
      ...extractCSharpImports(
        source,
      ),
    );
  }

  if (
    source &&
    language === "ruby" &&
    normalized.length === 0
  ) {
    normalized.push(
      ...extractRubyImports(
        source,
      ),
    );
  }

  return normalized;
}