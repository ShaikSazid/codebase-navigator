import { detectLanguage } from "./language-registry.js";

import {
  parseSource,
  type ParsedFile,
} from "./tree-sitter-parser.js";

import {
  normalizeImports,
} from "./import-normalizer.js";

import {
  resolveImports,
  buildResolvedRelationships,
} from "./import-resolver.js";

import type {
  CodeIndex,
  CodeRelationship,
  CodeSymbol,
  CodeSymbolKind,
  RepositorySourceFile,
} from "./indexer.types.js";

interface RawSpan {
  startLine?: number;
  endLine?: number;
}

interface RawKind {
  type?: string;
}

interface RawStructureItem {
  kind?: RawKind | string;
  name?: string;
  span?: RawSpan;
  signature?: string;
  children?: RawStructureItem[];
}

function getKindName(
  kind: RawStructureItem["kind"],
): string {
  if (typeof kind === "string") {
    return kind;
  }

  return kind?.type ?? "Unknown";
}

function normalizeSymbolKind(
  kind: string,
  insideClass: boolean,
): CodeSymbolKind {
  const normalized = kind.toLowerCase();

  switch (normalized) {
    case "class":
      return "class";

    case "function":
      return insideClass ? "method" : "function";

    case "method":
      return "method";

    case "interface":
      return "interface";

    case "struct":
      return "struct";

    case "enum":
      return "enum";

    case "trait":
      return "trait";

    case "type":
      return "type";

    case "variable":
      return "variable";

    case "constant":
      return "constant";

    default:
      return "unknown";
  }
}

function isRawStructureItem(
  value: unknown,
): value is RawStructureItem {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function flattenStructure(
  items: unknown[],
  filePath: string,
  repositoryId: string,
  symbols: CodeSymbol[],
  relationships: CodeRelationship[],
  parentKind?: string,
): void {
  for (const item of items) {
    if (!isRawStructureItem(item)) {
      continue;
    }

    const name = item.name;

    if (!name) {
      continue;
    }

    const rawKind = getKindName(item.kind);

    const symbolKind = normalizeSymbolKind(
      rawKind,
      parentKind?.toLowerCase() === "class",
    );

    const startLine = item.span?.startLine ?? 0;

    const endLine =
      item.span?.endLine ?? startLine;

    const symbolId =
      `${repositoryId}:${filePath}:${symbolKind}:${name}:${startLine}`;

    symbols.push({
      id: symbolId,
      name,
      kind: symbolKind,
      filePath,
      startLine,
      endLine,
      signature: item.signature,
    });

    relationships.push({
      source: filePath,
      target: symbolId,
      kind: "defines",
    });

    if (Array.isArray(item.children)) {
      flattenStructure(
        item.children,
        filePath,
        repositoryId,
        symbols,
        relationships,
        rawKind,
      );
    }
  }
}

export function indexRepositoryFiles(
  repositoryId: string,
  files: RepositorySourceFile[],
): CodeIndex {
  const index: CodeIndex = {
    repositoryId,
    files: [],
    symbols: [],
    relationships: [],
  };

  /*
   * Phase 1:
   *
   * Parse every supported source file and build
   * the normalized file + symbol index.
   */
  for (const file of files) {
    const language = detectLanguage(
      file.filePath,
    );

    if (!language) {
      continue;
    }

    let parsed: ParsedFile;

    try {
      parsed = parseSource(
        file.content,
        language,
      );
    } catch {
      continue;
    }

    const imports = normalizeImports(
      parsed.language,
      parsed.imports,
    );

    index.files.push({
      path: file.filePath,
      language: parsed.language,
      lineCount: parsed.metrics.totalLines,
      imports,
    });

    flattenStructure(
      parsed.structure,
      file.filePath,
      repositoryId,
      index.symbols,
      index.relationships,
    );
  }

  const resolvedImports =
    resolveImports(index);
  index.relationships.push(
    ...buildResolvedRelationships(
      resolvedImports,
    ),
  );

  return index;
}