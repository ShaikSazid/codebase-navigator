import type {
  LanguageAnalyzer,
} from "./language-analyzer.js";

import {
  javascriptAnalyzer,
} from "./javascript-analyzer.js";

import {
  typescriptAnalyzer,
} from "./typescript-analyzer.js";

import {
  pythonAnalyzer,
} from "./python-analyzer.js";

import {
  javaAnalyzer,
} from "./java-analyzer.js";

import {
  goAnalyzer,
} from "./go-analyzer.js";

import {
  rustAnalyzer,
} from "./rust-analyzer.js";

import {
  csharpAnalyzer,
} from "./csharp-analyzer.js";

import {
  rubyAnalyzer,
} from "./ruby-analyzer.js";

const analyzers:
  LanguageAnalyzer[] = [
    javascriptAnalyzer,
    typescriptAnalyzer,
    pythonAnalyzer,
    javaAnalyzer,
    goAnalyzer,
    rustAnalyzer,
    csharpAnalyzer,
    rubyAnalyzer,
  ];

export function getLanguageAnalyzer(
  language: string,
): LanguageAnalyzer | null {
  return (
    analyzers.find(
      (analyzer) =>
        analyzer.canAnalyze(language),
    ) ?? null
  );
}