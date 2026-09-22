import { extname } from "node:path";

import { detectLanguage } from "../language-registry.js";
import {
  parseSource,
  parseSourceAst,
} from "../tree-sitter-parser.js";
import { normalizeImports } from "../import-normalizer.js";

import type {
  CodeRelationship,
  CodeSymbol,
  NormalizedImport,
  RepositorySourceFile,
} from "../indexer.types.js";

import type { DataModel } from "./data-model.types.js";
import {
  getDataModelAnalyzer,
} from "./data-model-registry.js";

export interface DataModelIndex {
  models: DataModel[];
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
}

function detectDataModelLanguage(
  filePath: string,
): string | null {
  if (extname(filePath).toLowerCase() === ".prisma") {
    return "prisma";
  }

  return detectLanguage(filePath);
}

function addUnique<T>(
  values: T[],
  additions: T[],
  key: (value: T) => string,
): void {
  const seen = new Set(values.map(key));

  for (const value of additions) {
    const valueKey = key(value);

    if (seen.has(valueKey)) {
      continue;
    }

    seen.add(valueKey);
    values.push(value);
  }
}

export function indexDataModels(
  repositoryId: string,
  files: RepositorySourceFile[],
): DataModelIndex {
  const result: DataModelIndex = {
    models: [],
    symbols: [],
    relationships: [],
  };

  for (const file of files) {
    const language = detectDataModelLanguage(file.filePath);

    if (!language) {
      continue;
    }

    let imports: NormalizedImport[] = [];
    let tree: unknown = null;

    try {
      const parsed = parseSource(
        file.content,
        language,
      );

      imports = normalizeImports(
        parsed.language,
        parsed.imports,
        file.content,
      );

      try {
        tree = parseSourceAst(
          file.content,
          language,
        );
      } catch {
        tree = null;
      }
    } catch {
      imports = [];
    }

    const analyzer = getDataModelAnalyzer(
      language,
      imports,
      file.content,
    );

    if (!analyzer) {
      continue;
    }

    let analysis: DataModelIndex;

    try {
      const analyzerResult = analyzer.analyze({
        repositoryId,
        filePath: file.filePath,
        language,
        source: file.content,
        tree,
        imports,
      });

      analysis = {
        models: analyzerResult.models,
        symbols: analyzerResult.symbols,
        relationships: analyzerResult.relationships,
      };
    } catch {
      continue;
    }

    addUnique(
      result.models,
      analysis.models,
      (model) => model.id,
    );

    addUnique(
      result.symbols,
      analysis.symbols,
      (symbol) => symbol.id,
    );

    addUnique(
      result.relationships,
      analysis.relationships,
      (relationship) =>
        `${relationship.source}->${relationship.target}:${relationship.kind}`,
    );
  }

  return result;
}
