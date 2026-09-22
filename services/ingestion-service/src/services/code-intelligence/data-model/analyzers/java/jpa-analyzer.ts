import type { DataModelAnalyzer, DataModelAnalyzerResult } from "../../data-model-analyzer.js";
import { buildDataModelResult, cleanLiteral, extractBalancedBlock, lineOf } from "../utils.js";

export const jpaAnalyzer: DataModelAnalyzer = {
  canAnalyze(language, imports, source = "") {
    return language === "java" && (imports.some((item) => /^jakarta\.persistence|^javax\.persistence/i.test(item.moduleSpecifier)) || /@Entity\b/.test(source));
  },

  analyze(input): DataModelAnalyzerResult {
    const models = [];
    const symbols = [];
    const relationships = [];
    const entityRegex = /@Entity(?:\s*\([^)]*\))?[\s\S]*?\bclass\s+([A-Za-z_$][\w$]*)/g;

    for (const match of input.source.matchAll(entityRegex)) {
      const modelName = match[1];
      if (!modelName || match.index === undefined) continue;
      const classKeyword = input.source.indexOf("class", match.index);
      if (classKeyword === -1) continue;
      const openBrace = input.source.indexOf("{", classKeyword);
      if (openBrace === -1) continue;
      const block = extractBalancedBlock(input.source, openBrace);
      if (!block) continue;

      const fields = [];
      const fieldRegex = /(?:@[A-Za-z_$][\w$]*(?:\([^)]*\))?\s*)*(?:private|protected|public)?\s*(?:static\s+)?(?:final\s+)?([A-Za-z_$][\w$<>,.?\[\]]*)\s+([A-Za-z_$][\w]*)\s*(?:=[^;]+)?;/g;
      for (const fieldMatch of block.text.matchAll(fieldRegex)) {
        const type = fieldMatch[1];
        const name = fieldMatch[2];
        if (!type || !name || fieldMatch.index === undefined) continue;
        const raw = block.text.slice(Math.max(0, fieldMatch.index - 300), fieldMatch.index);
        const absolute = block.start + 1 + fieldMatch.index;
        const references = raw.match(/@(?:ManyToOne|OneToOne|ManyToMany|OneToMany)[\s\S]*?@JoinColumn[\s\S]*?\n?\s*(?:private|protected|public)?\s*([A-Za-z_$][\w$<>,.?\[\]]*)/)?.[1];
        fields.push({
          name,
          type,
          required: /@Column\s*\([^)]*nullable\s*=\s*false/.test(raw) || /@Id\b/.test(raw) || undefined,
          unique: /@Column\s*\([^)]*unique\s*=\s*true/.test(raw) || undefined,
          nullable: /nullable\s*=\s*true/.test(raw) || undefined,
          defaultValue: raw.match(/@Column\s*\([^)]*columnDefinition\s*=\s*["']([^"']+)["']/)?.[1] ? cleanLiteral(raw.match(/@Column\s*\([^)]*columnDefinition\s*=\s*["']([^"']+)["']/)![1]!) : undefined,
          references,
          startLine: lineOf(input.source, absolute),
          endLine: lineOf(input.source, absolute),
        });
      }

      const tableName = input.source.slice(match.index, openBrace).match(/@Table\s*\(\s*name\s*=\s*["']([^"']+)["']/)?.[1];
      const result = buildDataModelResult(input.repositoryId, input.filePath, {
        name: modelName,
        kind: "entity",
        framework: "jpa",
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
