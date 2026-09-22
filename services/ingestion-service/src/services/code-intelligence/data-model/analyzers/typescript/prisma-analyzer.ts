import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, lineOf } from "../utils.js";

export const prismaAnalyzer: DataModelAnalyzer = {
  canAnalyze(language) {
    return language === "prisma";
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const modelRegex = /(^|\n)\s*model\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\n\s*\}/g;

    for (const match of input.source.matchAll(modelRegex)) {
      const modelName = match[2];
      const body = match[3];
      if (!modelName || body === undefined || match.index === undefined) continue;
      const bodyStart = match.index + match[0].indexOf(body);
      const fields = [];

      for (const line of body.split("\n")) {
        const fieldMatch = line.match(/^\s*([A-Za-z_][\w]*)\s+([A-Za-z_][\w\.\[\]?]*)(.*)$/);
        if (!fieldMatch?.[1] || !fieldMatch[2]) continue;
        const name = fieldMatch[1];
        const type = fieldMatch[2];
        const attrs = fieldMatch[3] ?? "";
        if (name.startsWith("@@")) continue;
        const references = attrs.match(/@relation\s*\([^)]*references:\s*\[([^\]]+)/)?.[1]?.trim();
        const offset = input.source.indexOf(line, bodyStart);
        fields.push({
          name,
          type,
          required: !type.endsWith("?") || undefined,
          nullable: type.endsWith("?") || undefined,
          array: type.includes("[]") || undefined,
          unique: /@unique\b/.test(attrs) || undefined,
          defaultValue: attrs.match(/@default\(([^)]*)\)/)?.[1] ? cleanLiteral(attrs.match(/@default\(([^)]*)\)/)![1]!) : undefined,
          references,
          startLine: lineOf(input.source, offset === -1 ? bodyStart : offset),
          endLine: lineOf(input.source, offset === -1 ? bodyStart : offset),
        });
      }

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "model",
        framework: "prisma",
        tableName: modelName,
        fields,
        startLine: lineOf(input.source, match.index),
        endLine: lineOf(input.source, match.index + match[0].length),
      });

      models.push(result.model);
      symbols.push(...result.symbols);
      relationships.push(...result.relationships);
    }

    return { models, symbols, relationships };
  },
};
