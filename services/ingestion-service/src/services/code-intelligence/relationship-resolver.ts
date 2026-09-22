import type {
  CodeIndex,
  CodeRelationship,
  CodeSymbol,
  NormalizedImport,
} from "./indexer.types.js";

import {
  resolveImports,
  type ResolvedImport,
} from "./import-resolver.js";

function getTerminalName(value: string): string {
  return value
    .replace(/\?\./g, ".")
    .replace(/^this\./, "")
    .replace(/^self\./, "")
    .replace(/::/g, ".")
    .split(".")
    .pop() ?? value;
}

function getQualifier(value: string): string | null {
  const normalized = value
    .replace(/\?\./g, ".")
    .replace(/::/g, ".");

  const parts = normalized.split(".");

  return parts.length > 1
    ? parts[0] ?? null
    : null;
}

function findUniqueSymbol(
  symbols: CodeSymbol[],
  predicate: (symbol: CodeSymbol) => boolean,
): CodeSymbol | null {
  const matches = symbols.filter(predicate);

  return matches.length === 1
    ? matches[0] ?? null
    : null;
}

function getImportsForFile(
  index: CodeIndex,
  filePath: string,
): NormalizedImport[] {
  return (
    index.files.find(
      (file) => file.path === filePath,
    )?.imports ?? []
  );
}

function findResolvedImport(
  resolvedImports: ResolvedImport[],
  sourceFile: string,
  moduleSpecifier: string,
): ResolvedImport | null {
  return (
    resolvedImports.find(
      (item) =>
        item.sourceFile === sourceFile &&
        item.moduleSpecifier === moduleSpecifier &&
        item.status === "internal" &&
        Boolean(item.targetFile),
    ) ?? null
  );
}

function resolveSameFile(
  relationship: CodeRelationship,
  index: CodeIndex,
): CodeSymbol | null {
  const sourceSymbol = index.symbols.find(
    (symbol) => symbol.id === relationship.source,
  );

  if (!sourceSymbol) {
    return null;
  }

  const targetName = getTerminalName(
    String(relationship.target),
  );

  return findUniqueSymbol(
    index.symbols,
    (symbol) =>
      symbol.filePath === sourceSymbol.filePath &&
      symbol.name === targetName,
  );
}

function resolveImported(
  relationship: CodeRelationship,
  index: CodeIndex,
  resolvedImports: ResolvedImport[],
): {
  symbol: CodeSymbol;
  confidence: number;
} | null {
  const sourceSymbol = index.symbols.find(
    (symbol) => symbol.id === relationship.source,
  );

  if (!sourceSymbol) {
    return null;
  }

  const targetName = String(relationship.target);
  const terminalName = getTerminalName(targetName);
  const qualifier = getQualifier(targetName);

  const imports = getImportsForFile(
    index,
    sourceSymbol.filePath,
  );

  const fallbackSymbols: Array<{
    symbol: CodeSymbol;
    confidence: number;
  }> = [];

  for (const importInfo of imports) {
    const resolved = findResolvedImport(
      resolvedImports,
      sourceSymbol.filePath,
      importInfo.moduleSpecifier,
    );

    if (!resolved?.targetFile) {
      continue;
    }

    const bindings = importInfo.bindings ?? [];

    for (const binding of bindings) {
      if (
        binding.importedName !== "*" &&
        binding.importedName !== "default" &&
        !qualifier &&
        binding.localName === targetName
      ) {
        const target = findUniqueSymbol(
          index.symbols,
          (symbol) =>
            symbol.filePath === resolved.targetFile &&
            symbol.name === binding.importedName,
        );

        if (target) {
          return {
            symbol: target,
            confidence: 0.88,
          };
        }
      }

      if (
        binding.importedName === "*" &&
        qualifier === binding.localName
      ) {
        const target = findUniqueSymbol(
          index.symbols,
          (symbol) =>
            symbol.filePath === resolved.targetFile &&
            symbol.name === terminalName,
        );

        if (target) {
          return {
            symbol: target,
            confidence: 0.82,
          };
        }
      }

      if (
        binding.importedName !== "*" &&
        binding.importedName !== "default" &&
        qualifier === binding.localName
      ) {
        const target = findUniqueSymbol(
          index.symbols,
          (symbol) =>
            symbol.filePath === resolved.targetFile &&
            symbol.name === terminalName,
        );

        if (target) {
          return {
            symbol: target,
            confidence: 0.84,
          };
        }
      }

      if (
        binding.importedName === "default" &&
        qualifier === binding.localName
      ) {
        const target = findUniqueSymbol(
          index.symbols,
          (symbol) =>
            symbol.filePath === resolved.targetFile &&
            symbol.name === terminalName,
        );

        if (target) {
          return {
            symbol: target,
            confidence: 0.82,
          };
        }
      }

      if (
        binding.importedName === "*" &&
        !qualifier
      ) {
        const target = findUniqueSymbol(
          index.symbols,
          (symbol) =>
            symbol.filePath === resolved.targetFile &&
            symbol.name === terminalName,
        );

        if (target) {
          fallbackSymbols.push({
            symbol: target,
            confidence: 0.7,
          });
        }
      }
    }

    if (bindings.length === 0) {
      const target = findUniqueSymbol(
        index.symbols,
        (symbol) =>
          symbol.filePath === resolved.targetFile &&
          symbol.name === terminalName,
      );

      if (target) {
        fallbackSymbols.push({
          symbol: target,
          confidence: 0.6,
        });
      }
    }

    const targetInImportedFile = findUniqueSymbol(
      index.symbols,
      (symbol) =>
        symbol.filePath === resolved.targetFile &&
        symbol.name === terminalName,
    );

    if (targetInImportedFile) {
      fallbackSymbols.push({
        symbol: targetInImportedFile,
        confidence: 0.84,
      });
    }
  }

  const uniqueFallbacks = fallbackSymbols.filter(
    (item, indexInArray, array) =>
      array.findIndex(
        (candidate) =>
          candidate.symbol.id === item.symbol.id,
      ) === indexInArray,
  );

  return uniqueFallbacks.length === 1
    ? uniqueFallbacks[0] ?? null
    : null;
}

export function resolveSymbolRelationships(
  index: CodeIndex,
): CodeIndex {
  const resolvedImports = resolveImports(index);

  const relationships: CodeRelationship[] = [];

  for (const relationship of index.relationships) {
    if (
      relationship.kind !== "calls" &&
      relationship.kind !== "instantiates" &&
      relationship.kind !== "extends" &&
      relationship.kind !== "implements" &&
      relationship.kind !== "returns"
    ) {
      relationships.push(relationship);
      continue;
    }

    const sameFile = resolveSameFile(
      relationship,
      index,
    );

    if (sameFile) {
      relationships.push({
        ...relationship,
        target: sameFile.id,
        confidence:
          relationship.confidence ?? 0.95,
      });

      continue;
    }

    const imported = resolveImported(
      relationship,
      index,
      resolvedImports,
    );

    if (imported) {
      relationships.push({
        ...relationship,
        target: imported.symbol.id,
        confidence: imported.confidence,
      });

      continue;
    }

    relationships.push(relationship);
  }

  const seen = new Set<string>();

  const deduplicated = relationships.filter(
    (relationship) => {
      const key = `${relationship.source}|${relationship.target}|${relationship.kind}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );

  return {
    ...index,
    relationships: deduplicated,
  };
}