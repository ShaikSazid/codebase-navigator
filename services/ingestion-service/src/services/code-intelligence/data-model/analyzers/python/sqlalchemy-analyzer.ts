import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, lineOf } from "../utils.js";

export const sqlalchemyAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "python" && (imports.some((item) => /^sqlalchemy(?:\.|$)/i.test(item.moduleSpecifier)) || /\b(?:Column|mapped_column|relationship)\s*\(/.test(source) || /class\s+\w+\((?:Base|DeclarativeBase)\)/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const classRegex = /^class\s+([A-Za-z_][\w]*)\s*\(([^)]*)\):/gm;

    for (const match of input.source.matchAll(classRegex)) {
      const modelName = match[1];
      const bases = match[2] ?? "";
      if (!modelName || match.index === undefined) continue;
      if (!/Base|DeclarativeBase|SQLAlchemy/i.test(bases)) continue;

      const start = match.index + match[0].length;
      const nextClass = input.source.slice(start).search(/^class\s+/m);
      const end = nextClass === -1 ? input.source.length : start + nextClass;
      const body = input.source.slice(start, end);
      const fields = [];

      const fieldRegex = /^\s+([A-Za-z_][\w]*)\s*=\s*(?:mapped_column|Column)\s*\(([^)]*)\)/gm;
      for (const fieldMatch of body.matchAll(fieldRegex)) {
        const name = fieldMatch[1];
        if (!name || fieldMatch.index === undefined) continue;
        const args = fieldMatch[2] ?? "";
        const absolute = start + fieldMatch.index;
        const type = args.match(/^\s*([A-Za-z_][\w.]*)/)?.[1];
        const references = args.match(/ForeignKey\s*\(\s*["']([^"']+)["']/)?.[1]?.split(".")[0];
        fields.push({
          name,
          type,
          required: /nullable\s*=\s*False|primary_key\s*=\s*True/.test(args) || undefined,
          unique: /unique\s*=\s*True/.test(args) || undefined,
          nullable: /nullable\s*=\s*True/.test(args) || undefined,
          defaultValue: args.match(/default\s*=\s*([^,]+)/)?.[1] ? cleanLiteral(args.match(/default\s*=\s*([^,]+)/)![1]!) : undefined,
          references,
          startLine: lineOf(input.source, absolute),
          endLine: lineOf(input.source, absolute),
        });
      }

      const relationshipRegex = /^\s+([A-Za-z_][\w]*)\s*=\s*relationship\s*\(\s*["']([^"']+)["']/gm;
      for (const relationMatch of body.matchAll(relationshipRegex)) {
        const name = relationMatch[1];
        const references = relationMatch[2];
        if (!name || !references || relationMatch.index === undefined) continue;
        fields.push({
          name,
          type: references,
          references,
          startLine: lineOf(input.source, start + relationMatch.index),
          endLine: lineOf(input.source, start + relationMatch.index),
        });
      }

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "entity",
        framework: "sqlalchemy",
        tableName: input.source.slice(start, end).match(/__tablename__\s*=\s*["']([^"']+)["']/)?.[1],
        fields,
        startLine: lineOf(input.source, match.index),
        endLine: lineOf(input.source, end),
      });

      models.push(result.model);
      symbols.push(...result.symbols);
      relationships.push(...result.relationships);
    }

    return { models, symbols, relationships };
  },
};
