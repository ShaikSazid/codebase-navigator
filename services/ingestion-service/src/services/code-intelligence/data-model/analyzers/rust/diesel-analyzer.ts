import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, lineOf, extractBalancedBlock } from "../utils.js";

export const dieselAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "rust" && (imports.some((item) => /^diesel(?:$|::)/i.test(item.moduleSpecifier)) || /#\[derive\([^)]*(?:Queryable|Insertable|Identifiable|AsChangeset)/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const structRegex = /(?:#\[derive\([^)]*(?:Queryable|Insertable|Identifiable|AsChangeset)[^)]*\)\]\s*)+pub\s+struct\s+([A-Za-z_][\w]*)\s*\{/g;

    for (const match of input.source.matchAll(structRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const openBrace = input.source.indexOf("{", match.index);
      if (openBrace === -1) continue;
      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;

      const fields = [];
      const fieldRegex = /^\s*(?:#\[[^\]]+\]\s*)*(?:pub\s+)?([A-Za-z_][\w]*)\s*:\s*([^,]+),/gm;
      for (const fieldMatch of block.text.matchAll(fieldRegex)) {
        const name = fieldMatch[1];
        const type = fieldMatch[2]?.trim();
        if (!name || !type || fieldMatch.index === undefined) continue;
        const preceding = block.text.slice(Math.max(0, fieldMatch.index - 200), fieldMatch.index);
        fields.push({
          name,
          type,
          required: !/Option\s*</.test(type) || undefined,
          nullable: /Option\s*</.test(type) || undefined,
          references: preceding.match(/belongs_to\s*\(\s*([A-Za-z_][\w]*)\s*\)/)?.[1],
          startLine: lineOf(input.source, block.start + 1 + fieldMatch.index),
          endLine: lineOf(input.source, block.start + 1 + fieldMatch.index),
        });
      }

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "record",
        framework: "diesel",
        tableName: input.source.slice(0, match.index).match(/table_name!\s*\(\s*([A-Za-z_][\w]*)\s*\)/)?.[1],
        fields,
        startLine: lineOf(input.source, match.index),
        endLine: lineOf(input.source, block.end),
      });

      models.push(result.model);
      symbols.push(...result.symbols);
      relationships.push(...result.relationships);
    }

    return { models, symbols, relationships };
  },
};
