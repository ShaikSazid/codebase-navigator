import type { DataModelAnalyzer, DataModelAnalyzerInput, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import type { CodeRelationship, NormalizedImport } from "../../../indexer.types.js";
import { buildDataModelResult, cleanLiteral, extractBalancedBlock, lineOf, splitTopLevel } from "../utils.js";

function hasMongooseSignal(imports: NormalizedImport[], source: string): boolean {
  return imports.some((item) => /^(mongoose|mongoose\/|@typegoose)/i.test(item.moduleSpecifier)) || /\b(?:mongoose\.)?Schema\s*\(/.test(source) || /\b(?:mongoose\.)?model\s*\(/.test(source);
}

function parseField(
  source: string,
  fileOffset: number,
  entry: string,
) {
  const match = entry.match(/^\s*["']?([A-Za-z_$][\w$]*)["']?\s*:\s*([\s\S]*)$/);
  if (!match?.[1] || !match[2]) return null;

  const name = match[1];
  const value = match[2].trim();
  const typeMatch = value.match(/\btype\s*:\s*([A-Za-z_$][\w$]*(?:\.\w+)*)/);
  const refMatch = value.match(/\bref\s*:\s*["']([^"']+)["']/);
  const defaultMatch = value.match(/\bdefault\s*:\s*([^,}\n]+)/);
  const array = /^\[/.test(value) || /\[\s*\{/.test(value);

  return {
    name,
    type: typeMatch?.[1] ?? (array ? "Array" : undefined),
    required: /\brequired\s*:\s*true/.test(value),
    unique: /\bunique\s*:\s*true/.test(value),
    nullable: /\b(required\s*:\s*false|nullable\s*:\s*true)/.test(value) || undefined,
    array: array || undefined,
    defaultValue: defaultMatch?.[1] ? cleanLiteral(defaultMatch[1]) : undefined,
    references: refMatch?.[1],
    startLine: lineOf(source, fileOffset + Math.max(0, entry.search(/\S/))),
    endLine: lineOf(source, fileOffset + entry.length),
  };
}

export const mongooseAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return ["javascript", "typescript", "tsx"].includes(language) && hasMongooseSignal(imports, source);
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships: CodeRelationship[] = [];
    const schemaRegex = /(?:const|let|var)\s+([A-Za-z_$][\w$]*Schema)\s*=\s*(?:new\s+)?(?:mongoose\.)?Schema\s*\(/g;
    const schemaMatches = [...input.source.matchAll(schemaRegex)];

    for (const match of schemaMatches) {
      const schemaName = match[1];
      if (!schemaName || match.index === undefined) continue;

      const parenIndex = input.source.indexOf("(", match.index);
      const openBrace = input.source.indexOf("{", parenIndex);
      if (openBrace === -1) continue;

      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;

      const fields = [];
      let cursor = block.start + 1;
      for (const entry of splitTopLevel(block.text)) {
        const parsed = parseField(input.source, cursor, entry);
        if (parsed) fields.push(parsed);
        cursor += entry.length + 1;
      }

      const schemaLine = lineOf(input.source, match.index);
      const schemaEndLine = lineOf(input.source, block.end);
      const schemaResult = buildDataModelResult(input.repositoryId, input.filePath, {
        name: schemaName,
        kind: "schema",
        framework: "mongoose",
        fields,
        startLine: schemaLine,
        endLine: schemaEndLine,
      });

      models.push(schemaResult.model);
      symbols.push(...schemaResult.symbols);
      relationships.push(...schemaResult.relationships);

      const modelRegex = new RegExp(`(?:mongoose\\.)?model\\s*\\(\\s*["']([^"']+)["']\\s*,\\s*${schemaName}\\b`);
      const modelMatch = input.source.match(modelRegex);
      if (!modelMatch?.[1] || modelMatch.index === undefined) continue;

      const modelStartLine = lineOf(input.source, modelMatch.index);
      const modelResult = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelMatch[1],
        kind: "model",
        framework: "mongoose",
        collectionName: modelMatch[1],
        fields,
        startLine: modelStartLine,
        endLine: schemaEndLine,
      });

      models.push(modelResult.model);
      symbols.push(...modelResult.symbols);
      relationships.push(...modelResult.relationships);
      relationships.push({
        source: modelResult.model.symbolId,
        target: schemaResult.model.symbolId,
        kind: "uses_schema",
        confidence: 0.99,
        evidence: {
          filePath: input.filePath,
          startLine: modelStartLine,
          endLine: modelStartLine,
        },
      });
    }

    return { models, symbols, relationships };
  },
};
