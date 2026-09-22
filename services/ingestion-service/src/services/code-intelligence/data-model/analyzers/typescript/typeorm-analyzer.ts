import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, extractBalancedBlock, lineOf } from "../utils.js";

function hasEntity(source: string): boolean {
  return /@Entity\s*(?:\(|\n)/.test(source);
}

export const typeormAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return ["javascript", "typescript", "tsx"].includes(language) && (imports.some((item) => /^(typeorm|@nestjs\/typeorm)$/i.test(item.moduleSpecifier)) || hasEntity(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const classRegex = /@Entity(?:\s*\(([^)]*)\))?[\s\S]*?class\s+([A-Za-z_$][\w$]*)/g;

    for (const match of input.source.matchAll(classRegex)) {
      const modelName = match[2];
      if (!modelName || match.index === undefined) continue;
      const classKeyword = input.source.indexOf("class", match.index);
      if (classKeyword === -1) continue;
      const classOpen = input.source.indexOf("{", classKeyword);
      if (classOpen === -1) continue;
      const block = extractBalancedBlock(input.source, classOpen);
      if (!block) continue;

      const fields = [];
      const fieldRegex = /(?:@PrimaryGeneratedColumn|@PrimaryColumn|@Column)\s*(?:\(([^)]*)\))?[\s\r\n]*([A-Za-z_$][\w$]*)\s*[!?]?\s*:\s*([^;\n]+);?/g;
      const fieldSource = block.text;
      for (const fieldMatch of fieldSource.matchAll(fieldRegex)) {
        const name = fieldMatch[2];
        if (!name || fieldMatch.index === undefined) continue;
        const rawType = fieldMatch[3]?.trim();
        const options = fieldMatch[1] ?? "";
        const absolute = block.start + 1 + fieldMatch.index;
        fields.push({
          name,
          type: rawType,
          required: !/nullable\s*:\s*true/.test(options) || undefined,
          unique: /unique\s*:\s*true/.test(options) || undefined,
          nullable: /nullable\s*:\s*true/.test(options) || undefined,
          defaultValue: options.match(/default\s*:\s*([^,}]+)/)?.[1] ? cleanLiteral(options.match(/default\s*:\s*([^,}]+)/)![1]!) : undefined,
          startLine: lineOf(input.source, absolute),
          endLine: lineOf(input.source, absolute),
        });
      }

      const entityName = match[1]?.match(/name\s*:\s*["']([^"']+)["']/)?.[1];
      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "entity",
        framework: "typeorm",
        tableName: entityName ?? modelName,
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
