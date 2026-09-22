import type {
  CodeIndex,
  CodeRelationship,
  CodeSymbol,
  NormalizedImport,
} from "./indexer.types.js";

import {
  resolveImports,
} from "./import-resolver.js";

import type {
  RelationshipCandidate,
} from "./relationship-extractor.js";

function getTerminalName(
  targetName: string,
): string {
  const normalized =
    targetName
      .replace(/\?\./g, ".")
      .replace(/^this\./, "")
      .replace(/^self\./, "");

  return (
    normalized
      .split(".")
      .pop() ??
    normalized
  );
}

function getQualifier(
  targetName: string,
): string | null {
  const normalized =
    targetName.replace(
      /\?\./g,
      ".",
    );

  const parts =
    normalized.split(".");

  if (parts.length < 2) {
    return null;
  }

  return parts[0] ?? null;
}

function findUniqueSymbol(
  symbols: CodeSymbol[],
  predicate: (
    symbol: CodeSymbol,
  ) => boolean,
): CodeSymbol | null {
  const matches =
    symbols.filter(predicate);

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
      (file) =>
        file.path === filePath,
    )?.imports ?? []
  );
}

function getResolvedImportTarget(
  index: CodeIndex,
  sourceFile: string,
  moduleSpecifier: string,
): string | null {
  const resolvedImports =
    resolveImports(index);

  const resolved =
    resolvedImports.find(
      (item) =>
        item.sourceFile ===
          sourceFile &&
        item.moduleSpecifier ===
          moduleSpecifier &&
        item.status ===
          "internal" &&
        item.targetFile,
    );

  return (
    resolved?.targetFile ??
    null
  );
}

function resolveImportedCall(
  candidate: RelationshipCandidate,
  index: CodeIndex,
): {
  symbol: CodeSymbol;
  confidence: number;
} | null {
  const imports =
    getImportsForFile(
      index,
      candidate.filePath,
    );

  if (imports.length === 0) {
    return null;
  }

  const qualifier =
    getQualifier(
      candidate.targetName,
    );

  const terminalName =
    getTerminalName(
      candidate.targetName,
    );

  for (const importInfo of imports) {
    const bindings =
      importInfo.bindings ?? [];

    const targetFile =
      getResolvedImportTarget(
        index,
        candidate.filePath,
        importInfo.moduleSpecifier,
      );

    if (!targetFile) {
      continue;
    }

    for (const binding of bindings) {
      if (
        binding.importedName === "*" &&
        qualifier ===
          binding.localName
      ) {
        const target =
          findUniqueSymbol(
            index.symbols,
            (symbol) =>
              symbol.filePath ===
                targetFile &&
              symbol.name ===
                terminalName,
          );

        if (target) {
          return {
            symbol: target,
            confidence: 0.82,
          };
        }
      }

      if (
        binding.importedName !==
          "default" &&
        !qualifier &&
        binding.localName ===
          candidate.targetName
      ) {
        const target =
          findUniqueSymbol(
            index.symbols,
            (symbol) =>
              symbol.filePath ===
                targetFile &&
              symbol.name ===
                binding.importedName,
          );

        if (target) {
          return {
            symbol: target,
            confidence: 0.88,
          };
        }
      }

      if (
        binding.importedName ===
          "default" &&
        qualifier ===
          binding.localName
      ) {
        const target =
          findUniqueSymbol(
            index.symbols,
            (symbol) =>
              symbol.filePath ===
                targetFile &&
              symbol.name ===
                terminalName,
          );

        if (target) {
          return {
            symbol: target,
            confidence: 0.82,
          };
        }
      }

      if (
        binding.importedName ===
          "default" &&
        !qualifier &&
        binding.localName ===
          candidate.targetName
      ) {
        const target =
          findUniqueSymbol(
            index.symbols,
            (symbol) =>
              symbol.filePath ===
                targetFile &&
              symbol.name ===
                candidate.targetName,
          );

        if (target) {
          return {
            symbol: target,
            confidence: 0.88,
          };
        }
      }
    }
  }

  return null;
}

function findSameFileTargets(
  candidate: RelationshipCandidate,
  symbols: CodeSymbol[],
): CodeSymbol[] {
  const terminalName =
    getTerminalName(
      candidate.targetName,
    );

  return symbols.filter(
    (symbol) =>
      symbol.filePath ===
        candidate.filePath &&
      (
        symbol.name ===
          candidate.targetName ||
        symbol.name ===
          terminalName
      ),
  );
}

export function resolveCallRelationships(
  candidates: RelationshipCandidate[],
  index: CodeIndex,
): CodeRelationship[] {
  const relationships:
    CodeRelationship[] = [];

  for (const candidate of candidates) {
    const source =
      candidate.sourceSymbolId ??
      candidate.filePath;

    const isQualifiedCall =
      candidate.targetName.includes(".") &&
      !candidate.targetName.startsWith(
        "this.",
      ) &&
      !candidate.targetName.startsWith(
        "self.",
      );

    if (isQualifiedCall) {
      const imported =
        resolveImportedCall(
          candidate,
          index,
        );

      if (imported) {
        if (
          source !==
          imported.symbol.id
        ) {
          relationships.push({
            source,
            target:
              imported.symbol.id,
            kind: candidate.kind,
            confidence:
              imported.confidence,
            evidence: {
              filePath:
                candidate.filePath,
              startLine:
                candidate.startLine,
              endLine:
                candidate.endLine,
            },
          });
        }

        continue;
      }
    }

    const sameFileTargets =
      findSameFileTargets(
        candidate,
        index.symbols,
      );

    if (
      sameFileTargets.length === 1
    ) {
      const target =
        sameFileTargets[0];

      if (
        target &&
        source !== target.id
      ) {
        relationships.push({
          source,
          target: target.id,
          kind: candidate.kind,
          confidence: 0.95,
          evidence: {
            filePath:
              candidate.filePath,
            startLine:
              candidate.startLine,
            endLine:
              candidate.endLine,
          },
        });
      }

      continue;
    }

    const imported =
      resolveImportedCall(
        candidate,
        index,
      );

    if (imported) {
      if (
        source !==
        imported.symbol.id
      ) {
        relationships.push({
          source,
          target:
            imported.symbol.id,
          kind: candidate.kind,
          confidence:
            imported.confidence,
          evidence: {
            filePath:
              candidate.filePath,
            startLine:
              candidate.startLine,
            endLine:
              candidate.endLine,
          },
        });
      }
    }
  }

  return relationships;
}