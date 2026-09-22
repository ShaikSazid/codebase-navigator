import type {
  CodeRelationship,
  CodeSymbol,
  NormalizedImport,
} from "../indexer.types.js";

import type { DataModel } from "./data-model.types.js";

export interface DataModelAnalyzerInput {
  repositoryId: string;
  filePath: string;
  language: string;
  source: string;
  tree: unknown;
  imports: NormalizedImport[];
}

export interface DataModelAnalyzerResult {
  models: DataModel[];
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
}

export interface DataModelAnalyzer {
  canAnalyze(
    language: string,
    imports: NormalizedImport[],
    source?: string,
  ): boolean;

  analyze(
    input: DataModelAnalyzerInput,
  ): DataModelAnalyzerResult;
}
