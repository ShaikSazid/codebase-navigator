import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, lineOf } from "../utils.js";

export const djangoAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "python" && (imports.some((item) => /^django(?:\.|$)/i.test(item.moduleSpecifier)) || /class\s+\w+\(models\.Model\)/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const classRegex = /^class\s+([A-Za-z_][\w]*)\s*\(models\.Model\):/gm;

    for (const match of input.source.matchAll(classRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const start = match.index + match[0].length;
      const nextClass = input.source.slice(start).search(/^class\s+/m);
      const end = nextClass === -1 ? input.source.length : start + nextClass;
      const body = input.source.slice(start, end);
      const fields = [];
      const fieldRegex = /^\s+([A-Za-z_][\w]*)\s*=\s*models\.([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm;

      for (const fieldMatch of body.matchAll(fieldRegex)) {
        const name = fieldMatch[1];
        const type = fieldMatch[2];
        if (!name || !type || fieldMatch.index === undefined) continue;
        const args = fieldMatch[3] ?? "";
        const absolute = start + fieldMatch.index;
        const references = args.match(/(?:to|model)\s*=\s*["']([^"']+)["']/)?.[1] ?? (type === "ForeignKey" || type === "OneToOneField" ? args.match(/^["']([^"']+)["']/)?.[1] : undefined);
        fields.push({
          name,
          type,
          required: /null\s*=\s*False/.test(args) || undefined,
          nullable: /null\s*=\s*True/.test(args) || undefined,
          unique: /unique\s*=\s*True/.test(args) || undefined,
          defaultValue: args.match(/default\s*=\s*([^,]+)/)?.[1] ? cleanLiteral(args.match(/default\s*=\s*([^,]+)/)![1]!) : undefined,
          references,
          startLine: lineOf(input.source, absolute),
          endLine: lineOf(input.source, absolute),
        });
      }

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "entity",
        framework: "django",
        tableName: input.source.slice(start, end).match(/db_table\s*=\s*["']([^"']+)["']/)?.[1],
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
