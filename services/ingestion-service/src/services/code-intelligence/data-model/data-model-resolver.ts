import type {
  CodeIndex,
  CodeRelationship,
  CodeSymbol,
} from "../indexer.types.js";

function terminalName(value: string): string {
  return value
    .replace(/\?\./g, ".")
    .replace(/::/g, ".")
    .split(".")
    .pop()
    ?.replace(/[\[\]]/g, "")
    .trim() ?? value;
}

function findUniqueModel(
  symbols: CodeSymbol[],
  name: string,
): CodeSymbol | null {
  const matches = symbols.filter(
    (symbol) =>
      symbol.kind === "model" &&
      symbol.name === name,
  );

  return matches.length === 1
    ? matches[0] ?? null
    : null;
}

export function resolveDataModelRelationships(
  index: CodeIndex,
  relationships: CodeRelationship[],
): CodeRelationship[] {
  return relationships.map((relationship) => {
    if (relationship.kind !== "references") {
      return relationship;
    }

    if (index.symbols.some((symbol) => symbol.id === relationship.target)) {
      return relationship;
    }

    const target = findUniqueModel(
      index.symbols,
      terminalName(String(relationship.target)),
    );

    if (!target) {
      return {
        ...relationship,
        confidence: Math.min(
          relationship.confidence ?? 0.5,
          0.45,
        ),
      };
    }

    return {
      ...relationship,
      target: target.id,
      confidence: Math.max(
        relationship.confidence ?? 0.75,
        0.8,
      ),
    };
  });
}
