import treeSitter from "@xberg-io/tree-sitter-language-pack";

const { process } = treeSitter;

export interface ParsedFile {
  language: string;

  structure: unknown[];
  imports: unknown[];
  exports: unknown[];
  symbols: unknown[];
  diagnostics: unknown[];

  metrics: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    totalBytes: number;
    nodeCount: number;
    errorCount: number;
    maxDepth: number;
  };
}

export function parseSource(
  source: string,
  language: string,
): ParsedFile {
  const result = process(source, {
    language,
    structure: true,
    imports: true,
    exports: true,
    symbols: true,
    diagnostics: true,
  });

  return {
    language: result.language ?? language,

    structure: result.structure ?? [],
    imports: result.imports ?? [],
    exports: result.exports ?? [],
    symbols: result.symbols ?? [],
    diagnostics: result.diagnostics ?? [],

    metrics: {
      totalLines: result.metrics?.totalLines ?? 0,
      codeLines: result.metrics?.codeLines ?? 0,
      commentLines: result.metrics?.commentLines ?? 0,
      blankLines: result.metrics?.blankLines ?? 0,
      totalBytes: result.metrics?.totalBytes ?? 0,
      nodeCount: result.metrics?.nodeCount ?? 0,
      errorCount: result.metrics?.errorCount ?? 0,
      maxDepth: result.metrics?.maxDepth ?? 0,
    },
  };
}