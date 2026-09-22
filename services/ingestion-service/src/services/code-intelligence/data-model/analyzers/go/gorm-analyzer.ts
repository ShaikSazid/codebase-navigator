import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, lineOf, extractBalancedBlock } from "../utils.js";

export const gormAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "go" && (imports.some((item) => /gorm\.io\/gorm/i.test(item.moduleSpecifier)) || /`gorm:[^`]+`/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const structRegex = /\btype\s+([A-Za-z_][\w]*)\s+struct\s*\{/g;

    for (const match of input.source.matchAll(structRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const openBrace = input.source.indexOf("{", match.index);
      if (openBrace === -1) continue;
      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;
      if (!/`gorm:[^`]+`/.test(block.text)) continue;

      const fields = [];
      const fieldRegex = /^\s*([A-Za-z_][\w]*)\s+([A-Za-z_][\w]*(?:\[[^\]]*\])?(?:\.[A-Za-z_][\w]*)?)\s*(`[^`]*`)?/gm;
      for (const fieldMatch of block.text.matchAll(fieldRegex)) {
        const name = fieldMatch[1];
        const type = fieldMatch[2];
        const tag = fieldMatch[3] ?? "";
        if (!name || !type || fieldMatch.index === undefined) continue;
        fields.push({
          name,
          type,
          required: /not null|primaryKey/i.test(tag) || undefined,
          unique: /unique/i.test(tag) || undefined,
          nullable: /null/i.test(type) || undefined,
          references: tag.match(/foreignKey:[^;]+;?references:([^;`]+)/i)?.[1],
          startLine: lineOf(input.source, block.start + 1 + fieldMatch.index),
          endLine: lineOf(input.source, block.start + 1 + fieldMatch.index),
        });
      }

      const tableName = block.text.match(/tablename:[^;`]+/i)?.[0]?.split(":")[1]?.trim();
      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "model",
        framework: "gorm",
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
