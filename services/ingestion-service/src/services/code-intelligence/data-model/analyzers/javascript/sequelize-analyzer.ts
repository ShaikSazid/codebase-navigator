import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, extractBalancedBlock, lineOf, splitTopLevel } from "../utils.js";

export const sequelizeAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return ["javascript", "typescript", "tsx"].includes(language) && (imports.some((item) => /^(sequelize|@sequelize)/i.test(item.moduleSpecifier)) || /\.define\s*\(/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const regex = /([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.define\s*\(\s*["']([^"']+)["']\s*,/g;

    for (const match of input.source.matchAll(regex)) {
      const modelVar = match[1];
      const modelName = match[3];
      if (!modelVar || !modelName || match.index === undefined) continue;

      const openBrace = input.source.indexOf("{", match.index);
      if (openBrace === -1) continue;
      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;

      const fields = [];
      let cursor = block.start + 1;
      for (const entry of splitTopLevel(block.text)) {
        const fieldMatch = entry.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
        if (!fieldMatch?.[1]) continue;
        const value = fieldMatch[2]?.trim() ?? "";
        const type = value.match(/^([A-Za-z_$][\w$]*(?:\.\w+)*)/)?.[1];
        const defaultValue = value.match(/defaultValue\s*:\s*([^,}]+)/)?.[1];
        fields.push({
          name: fieldMatch[1],
          type,
          required: /allowNull\s*:\s*false|primaryKey\s*:\s*true/.test(value) || undefined,
          unique: /unique\s*:\s*true/.test(value) || undefined,
          nullable: /allowNull\s*:\s*true/.test(value) || undefined,
          defaultValue: defaultValue ? cleanLiteral(defaultValue) : undefined,
          startLine: lineOf(input.source, cursor),
          endLine: lineOf(input.source, cursor + entry.length),
        });
        cursor += entry.length + 1;
      }

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "model",
        framework: "sequelize",
        tableName: modelName,
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
