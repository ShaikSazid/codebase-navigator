import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, extractBalancedBlock, lineOf } from "../utils.js";

export const efCoreAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "csharp" && (imports.some((item) => /^Microsoft\.EntityFrameworkCore/i.test(item.moduleSpecifier)) || /\[Table\s*\(/.test(source) || /\bDbSet\s*</.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const classRegex = /(?:\[[^\]]+\]\s*)*(?:public\s+)?(?:partial\s+)?class\s+([A-Za-z_][\w]*)[^\{]*\{/g;

    for (const match of input.source.matchAll(classRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const prefix = input.source.slice(Math.max(0, match.index - 250), match.index);
      if (!/\[Table\s*\(/.test(prefix) && !/\[Key\]/.test(input.source.slice(match.index, match.index + 1000))) continue;
      const openBrace = input.source.indexOf("{", match.index);
      if (openBrace === -1) continue;
      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;

      const fields = [];
      const fieldRegex = /(?:\[[^\]]+\]\s*)*(?:public|protected|internal)?\s*(?:virtual\s+)?(?:required\s+)?([A-Za-z_][\w<>?,\[\].]*)\s+([A-Za-z_][\w]*)\s*\{\s*(?:get;)?\s*(?:set;)?/g;
      for (const fieldMatch of block.text.matchAll(fieldRegex)) {
        const type = fieldMatch[1];
        const name = fieldMatch[2];
        if (!name || !type || fieldMatch.index === undefined) continue;
        const preceding = block.text.slice(Math.max(0, fieldMatch.index - 250), fieldMatch.index);
        fields.push({
          name,
          type,
          required: /\[Key\]|required\s+/.test(preceding + fieldMatch[0]) || undefined,
          unique: /\[Index\([^\]]*IsUnique\s*=\s*true/.test(preceding) || undefined,
          nullable: type.includes("?") || undefined,
          defaultValue: preceding.match(/\[DefaultValue\s*\(\s*["']?([^\)"']+)/)?.[1] ? cleanLiteral(preceding.match(/\[DefaultValue\s*\(\s*["']?([^\)"']+)/)![1]!) : undefined,
          startLine: lineOf(input.source, block.start + 1 + fieldMatch.index),
          endLine: lineOf(input.source, block.start + 1 + fieldMatch.index),
        });
      }

      const tableName = prefix.match(/\[Table\s*\(\s*["']([^"']+)["']/)?.[1];
      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "entity",
        framework: "efcore",
        tableName: tableName ?? modelName,
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
