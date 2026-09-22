import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, lineOf } from "../utils.js";

export const pydanticAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "python" && (imports.some((item) => /^pydantic(?:\.|$)/i.test(item.moduleSpecifier)) || /class\s+\w+\([^)]*BaseModel[^)]*\)/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const classRegex = /^class\s+([A-Za-z_][\w]*)\s*\([^)]*BaseModel[^)]*\):/gm;

    for (const match of input.source.matchAll(classRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const start = match.index + match[0].length;
      const nextClass = input.source.slice(start).search(/^class\s+/m);
      const end = nextClass === -1 ? input.source.length : start + nextClass;
      const body = input.source.slice(start, end);
      const fields = [];
      const fieldRegex = /^\s+([A-Za-z_][\w]*)\s*:\s*([^=\n]+)(?:=\s*(.*))?$/gm;

      for (const fieldMatch of body.matchAll(fieldRegex)) {
        const name = fieldMatch[1];
        const type = fieldMatch[2]?.trim();
        if (!name || !type || fieldMatch.index === undefined) continue;
        const defaultValue = fieldMatch[3]?.trim();
        fields.push({
          name,
          type,
          required: !/Optional\s*\[|None/.test(type) || undefined,
          nullable: /Optional\s*\[|None/.test(type) || undefined,
          array: /List\[|list\[/.test(type) || undefined,
          defaultValue: defaultValue ? cleanLiteral(defaultValue) : undefined,
          startLine: lineOf(input.source, start + fieldMatch.index),
          endLine: lineOf(input.source, start + fieldMatch.index),
        });
      }

      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "schema",
        framework: "pydantic",
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
