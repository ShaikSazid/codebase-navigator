import type {
  CodeRelationship,
  CodeSymbol,
} from "../../indexer.types.js";

import type {
  DataModel,
  DataModelField,
  DataModelKind,
} from "../data-model.types.js";

export function lineOf(
  source: string,
  index: number,
): number {
  return source.slice(0, index).split("\n").length;
}

export function extractBalancedBlock(
  source: string,
  openIndex: number,
  openChar = "{",
  closeChar = "}",
): {
  text: string;
  start: number;
  end: number;
} | null {
  if (source[openIndex] !== openChar) {
    return null;
  }

  let depth = 0;
  let quote: string | null = null;
  let escape = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "/" && next === "/") {
      const newline = source.indexOf("\n", index + 2);
      index = newline === -1 ? source.length : newline;
      continue;
    }

    if (char === "/" && next === "*") {
      const endComment = source.indexOf("*/", index + 2);
      index = endComment === -1 ? source.length : endComment + 1;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;

      if (depth === 0) {
        return {
          text: source.slice(openIndex + 1, index),
          start: openIndex,
          end: index,
        };
      }
    }
  }

  return null;
}

export function splitTopLevel(
  text: string,
  delimiter = ",",
): string[] {
  const parts: string[] = [];
  let start = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote: string | null = null;
  let escape = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth -= 1;
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth -= 1;

    if (
      char === delimiter &&
      braceDepth === 0 &&
      bracketDepth === 0 &&
      parenDepth === 0
    ) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(text.slice(start));

  return parts;
}

export function cleanLiteral(
  value: string,
): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^`|`$/g, "")
    .trim();
}

export function fieldFromLine(
  source: string,
  fileOffset: number,
  name: string,
  type?: string,
  options?: Partial<DataModelField>,
): DataModelField {
  const startLine = lineOf(source, fileOffset);

  return {
    name,
    type,
    startLine,
    endLine: startLine,
    ...options,
  };
}

export function buildDataModelResult(
  repositoryId: string,
  filePath: string,
  model: {
    name: string;
    kind: DataModelKind;
    framework?: string;
    tableName?: string;
    collectionName?: string;
    fields: DataModelField[];
    startLine: number;
    endLine: number;
  },
): {
  model: DataModel;
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
} {
  const modelSymbolId =
    `${repositoryId}:${filePath}:model:${model.name}:${model.startLine}`;

  const modelSymbol: CodeSymbol = {
    id: modelSymbolId,
    name: model.name,
    kind: model.kind === "schema" ? "schema" : "model",
    filePath,
    startLine: model.startLine,
    endLine: model.endLine,
    signature: `${model.kind} ${model.name}`,
  };

  const symbols: CodeSymbol[] = [modelSymbol];

  const relationships: CodeRelationship[] = [
    {
      source: filePath,
      target: modelSymbolId,
      kind: "defines",
    },
  ];

  for (const field of model.fields) {
    const fieldStartLine = field.startLine ?? model.startLine;
    const fieldEndLine = field.endLine ?? fieldStartLine;

    const fieldSymbolId =
      `${repositoryId}:${filePath}:field:${model.name}.${field.name}:${fieldStartLine}`;

    symbols.push({
      id: fieldSymbolId,
      name: field.name,
      kind: "field",
      filePath,
      startLine: fieldStartLine,
      endLine: fieldEndLine,
      signature: `${field.name}${field.type ? `: ${field.type}` : ""}`,
    });

    relationships.push({
      source: modelSymbolId,
      target: fieldSymbolId,
      kind: "has_field",
      evidence: {
        filePath,
        startLine: fieldStartLine,
        endLine: fieldEndLine,
      },
    });

    if (field.references) {
      relationships.push({
        source: fieldSymbolId,
        target: field.references,
        kind: "references",
        confidence: 0.75,
        evidence: {
          filePath,
          startLine: fieldStartLine,
          endLine: fieldEndLine,
        },
      });
    }
  }

  const dataModel: DataModel = {
    id: modelSymbolId,
    name: model.name,
    kind: model.kind,
    filePath,
    framework: model.framework,
    tableName: model.tableName,
    collectionName: model.collectionName,
    fields: model.fields,
    startLine: model.startLine,
    endLine: model.endLine,
    symbolId: modelSymbolId,
  };

  return {
    model: dataModel,
    symbols,
    relationships,
  };
}
