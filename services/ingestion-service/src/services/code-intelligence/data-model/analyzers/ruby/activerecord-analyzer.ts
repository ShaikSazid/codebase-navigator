import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, lineOf } from "../utils.js";

export const activeRecordAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "ruby" && (imports.some((item) => /^(active_record|rails)/i.test(item.moduleSpecifier)) || /class\s+\w+\s*<\s*(?:ApplicationRecord|ActiveRecord::Base)/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const classRegex = /^class\s+([A-Za-z_][\w]*)\s*<\s*(ApplicationRecord|ActiveRecord::Base)/gm;

    for (const match of input.source.matchAll(classRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const start = match.index;
      const nextClass = input.source.slice(start + match[0].length).search(/^class\s+/m);
      const end = nextClass === -1 ? input.source.length : start + match[0].length + nextClass;
      const body = input.source.slice(start, end);
      const fields = [];

      for (const fieldMatch of body.matchAll(/^\s*(belongs_to|has_many|has_one)\s+:([A-Za-z_][\w]*)/gm)) {
        const name = fieldMatch[2];
        if (!name || fieldMatch.index === undefined) continue;
        fields.push({
          name,
          type: fieldMatch[1],
          references: name.replace(/_id$/, "").replace(/_/, " ").replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\s/g, ""),
          startLine: lineOf(input.source, start + fieldMatch.index),
          endLine: lineOf(input.source, start + fieldMatch.index),
        });
      }

      for (const fieldMatch of body.matchAll(/^\s*attribute\s+:([A-Za-z_][\w]*)\s*(?:,\s*:([A-Za-z_][\w]*))?/gm)) {
        const name = fieldMatch[1];
        if (!name || fieldMatch.index === undefined) continue;
        fields.push({
          name,
          type: fieldMatch[2],
          startLine: lineOf(input.source, start + fieldMatch.index),
          endLine: lineOf(input.source, start + fieldMatch.index),
        });
      }

      const tableName = body.match(/^\s*self\.table_name\s*=\s*["']([^"']+)["']/m)?.[1];
      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "model",
        framework: "activerecord",
        tableName: tableName ?? modelName.toLowerCase() + "s",
        fields,
        startLine: lineOf(input.source, start),
        endLine: lineOf(input.source, end),
      });

      models.push(result.model);
      symbols.push(...result.symbols);
      relationships.push(...result.relationships);
    }

    return { models, symbols, relationships };
  },
};
