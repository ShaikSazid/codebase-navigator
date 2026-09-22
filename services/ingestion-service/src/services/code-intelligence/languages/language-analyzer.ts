import type {
  CodeRelationship,
  CodeSymbol,
} from "../indexer.types.js";

export interface LanguageAnalyzerInput {
  filePath: string;
  source: string;
  tree: unknown;
  symbols: CodeSymbol[];
}

export interface LanguageAnalyzer {
  canAnalyze(language: string): boolean;

  extractRelationships(
    input: LanguageAnalyzerInput,
  ): CodeRelationship[];
}