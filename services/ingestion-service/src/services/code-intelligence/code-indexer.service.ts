import { detectLanguage } from "./language-registry.js";

import {
  indexDataModels,
} from "./data-model/data-model-indexer.js";

import {
  resolveDataModelRelationships,
} from "./data-model/data-model-resolver.js";

import {
  parseSource,
  parseSourceAst,
  type ParsedFile,
} from "./tree-sitter-parser.js";

import {
  resolveDataAccessRelationships,
} from "./data-access-resolver.js";

import {
  getLanguageAnalyzer,
} from "./languages/index.js";

import {
  normalizeImports,
} from "./import-normalizer.js";

import {
  resolveImports,
  buildResolvedRelationships,
} from "./import-resolver.js";

import {
  resolveSymbolRelationships,
} from "./relationship-resolver.js";

import {
  extractJavaScriptRoutes,
} from "./route-extractor.js";

import {
  resolveRouteRelationships,
} from "./route-resolver.js";

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
  const normalized =
    kind.toLowerCase();

  switch (normalized) {
    case "class":
      return "class";

    case "function":
      return insideClass
        ? "method"
        : "function";

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

    case "route":
      return "route";

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

function symbolKey(
  symbol: CodeSymbol,
): string {
  return [
    symbol.filePath,
    symbol.kind,
    symbol.name,
    symbol.startLine,
    symbol.endLine,
  ].join("|");
}

function relationshipKey(
  relationship: CodeRelationship,
): string {
  return [
    relationship.source,
    relationship.target,
    relationship.kind,
    relationship.evidence?.filePath ?? "",
    relationship.evidence?.startLine ?? "",
  ].join("|");
}

function addUniqueSymbols(
  target: CodeSymbol[],
  symbols: CodeSymbol[],
): void {
  const seen =
    new Set(
      target.map(symbolKey),
    );

  for (const symbol of symbols) {
    const key =
      symbolKey(symbol);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    target.push(symbol);
  }
}

function addUniqueRelationships(
  target: CodeRelationship[],
  relationships: CodeRelationship[],
): void {
  const seen =
    new Set(
      target.map(
        relationshipKey,
      ),
    );

  for (const relationship of relationships) {
    const key =
      relationshipKey(
        relationship,
      );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    target.push(
      relationship,
    );
  }
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

    const name =
      item.name;

    if (!name) {
      continue;
    }

    const rawKind =
      getKindName(
        item.kind,
      );

    const symbolKind =
      normalizeSymbolKind(
        rawKind,
        parentKind?.toLowerCase() ===
          "class",
      );

    const startLine =
      item.span?.startLine ?? 0;

    const endLine =
      item.span?.endLine ??
      startLine;

    const symbolId =
      `${repositoryId}:${filePath}:${symbolKind}:${name}:${startLine}`;

    const symbol: CodeSymbol = {
      id: symbolId,
      name,
      kind: symbolKind,
      filePath,
      startLine,
      endLine,
      signature:
        item.signature,
    };

    addUniqueSymbols(
      symbols,
      [symbol],
    );

    addUniqueRelationships(
      relationships,
      [
        {
          source: filePath,
          target: symbolId,
          kind: "defines",
          confidence: 1,
          evidence: {
            filePath,
            startLine,
            endLine,
          },
        },
      ],
    );

    if (
      Array.isArray(
        item.children,
      )
    ) {
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

function isJavaScriptFamily(
  language: string,
): boolean {
  return (
    language === "javascript" ||
    language === "typescript" ||
    language === "tsx"
  );
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
    dataModels: [],
  };

  for (const file of files) {
    const language =
      detectLanguage(
        file.filePath,
      );

    if (!language) {
      continue;
    }

    let parsed: ParsedFile;

    try {
      parsed =
        parseSource(
          file.content,
          language,
        );
    } catch {
      continue;
    }

    const imports =
      normalizeImports(
        parsed.language,
        parsed.imports,
        file.content,
      );

    index.files.push({
      path: file.filePath,
      language:
        parsed.language,
      lineCount:
        parsed.metrics.totalLines,
      imports,
    });

    flattenStructure(
      parsed.structure,
      file.filePath,
      repositoryId,
      index.symbols,
      index.relationships,
    );

    try {
      const ast =
        parseSourceAst(
          file.content,
          language,
        );

      const analyzer =
        getLanguageAnalyzer(
          parsed.language,
        );

      if (analyzer) {
        const analyzerRelationships =
          analyzer.extractRelationships({
            filePath:
              file.filePath,
            source:
              file.content,
            tree:
              ast.tree,
            symbols:
              index.symbols.filter(
                (symbol) =>
                  symbol.filePath ===
                  file.filePath,
              ),
          });

        addUniqueRelationships(
          index.relationships,
          analyzerRelationships,
        );
      }

      if (
        isJavaScriptFamily(
          parsed.language,
        )
      ) {
        const routeResult =
          extractJavaScriptRoutes({
            repositoryId,
            filePath:
              file.filePath,
            source:
              file.content,
            tree:
              ast.tree,
          });

        addUniqueSymbols(
          index.symbols,
          routeResult.symbols,
        );

        addUniqueRelationships(
          index.relationships,
          routeResult.relationships,
        );
      }
    } catch {
      continue;
    }
  }

  const dataModelIndex =
    indexDataModels(
      repositoryId,
      files,
    );

  addUniqueSymbols(
    index.symbols,
    dataModelIndex.symbols,
  );

  index.dataModels =
    dataModelIndex.models;

  const resolvedImports =
    resolveImports(index);

  const importRelationships =
    buildResolvedRelationships(
      resolvedImports,
    );

  addUniqueRelationships(
    index.relationships,
    importRelationships,
  );

  const dataAccessRelationships =
    resolveDataAccessRelationships(
      index,
    );

  index.relationships =
    index.relationships.filter(
      (relationship) =>
        relationship.kind !==
          "queries" &&
        relationship.kind !==
          "writes" &&
        relationship.kind !==
          "reads" &&
        relationship.kind !==
          "instantiates",
    );

  addUniqueRelationships(
    index.relationships,
    dataAccessRelationships,
  );

  const symbolRelationships =
    resolveSymbolRelationships(
      index,
    );

  index.relationships =
    symbolRelationships.relationships;

  const routeRelationships =
    resolveRouteRelationships(
      index,
    );

  const routeKeys =
    new Set(
      routeRelationships.map(
        relationshipKey,
      ),
    );

  index.relationships =
    index.relationships.filter(
      (relationship) => {
        if (
          relationship.kind !==
            "routes_to" &&
          relationship.kind !==
            "handles"
        ) {
          return true;
        }

        return routeKeys.has(
          relationshipKey(
            relationship,
          ),
        );
      },
    );

  addUniqueRelationships(
    index.relationships,
    routeRelationships,
  );

  const dataModelRelationships =
    resolveDataModelRelationships(
      index,
      dataModelIndex.relationships,
    );

  addUniqueRelationships(
    index.relationships,
    dataModelRelationships,
  );

  return index;
}