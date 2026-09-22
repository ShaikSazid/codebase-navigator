import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, extractBalancedBlock, lineOf } from "../utils.js";

export const seaOrmAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "rust" && (
      imports.some((item) => /^sea_orm(?:$|::)/i.test(item.moduleSpecifier)) ||
      /DeriveEntityModel/.test(source) ||
      /impl\s+ActiveModelBehavior\s+for/.test(source)
    );
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const structRegex = /(?:#\[(?:derive\([^)]*DeriveEntityModel[^)]*\)|sea_orm\([^)]*\))\]\s*)*pub\s+struct\s+([A-Za-z_][\w]*)\s*\{/g;

    for (const match of input.source.matchAll(structRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;

      const openBrace = input.source.indexOf("{", match.index);
      if (openBrace === -1) continue;

      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;

      const fields = [];
      const fieldRegex = /^\s*(?:pub\s+)?([A-Za-z_][\w]*)\s*:\s*([^,]+),/gm;

      for (const fieldMatch of block.text.matchAll(fieldRegex)) {
        const name = fieldMatch[1];
        const type = fieldMatch[2]?.trim();
        if (!name || !type || fieldMatch.index === undefined) continue;

        const absolute = block.start + 1 + fieldMatch.index;
        fields.push({
          name,
          type,
          required: !/Option\s*</.test(type) || undefined,
          nullable: /Option\s*</.test(type) || undefined,
          array: /Vec\s*</.test(type) || undefined,
          startLine: lineOf(input.source, absolute),
          endLine: lineOf(input.source, absolute),
        });
      }

      const tableName = input.source
        .slice(Math.max(0, match.index - 500), match.index)
        .match(/table_name\s*:\s*([A-Za-z_][\w]*)/)?.[1];

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "entity",
        framework: "sea-orm",
        tableName,
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
