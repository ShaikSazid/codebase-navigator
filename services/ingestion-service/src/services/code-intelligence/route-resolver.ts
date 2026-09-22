import {
  resolveImports,
} from "./import-resolver.js";

import type {
  CodeIndex,
  CodeRelationship,
  CodeSymbol,
} from "./indexer.types.js";

function getTerminalName(
  value: string,
): string {
  return value
    .replace(/\?\./g, ".")
    .replace(/^this\./, "")
    .replace(/^self\./, "")
    .replace(/::/g, ".")
    .split(".")
    .pop()
    ?.trim() ?? value;
}

function getQualifier(
  value: string,
): string | null {
  const normalized =
    value
      .replace(/\?\./g, ".")
      .replace(/::/g, ".");

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
    symbols.filter(
      predicate,
    );

  return matches.length === 1
    ? matches[0]
    : null;
}

function resolveRouteTarget(
  index: CodeIndex,
  sourceFile: string,
  expression: string,
): CodeSymbol | null {
  const terminalName =
    getTerminalName(
      expression,
    );

  const qualifier =
    getQualifier(
      expression,
    );

  const sameFileSymbol =
    findUniqueSymbol(
      index.symbols,
      (symbol) =>
        symbol.filePath ===
          sourceFile &&
        symbol.name ===
          terminalName &&
        symbol.kind !== "route",
    );

  if (sameFileSymbol) {
    return sameFileSymbol;
  }

  const file =
    index.files.find(
      (candidate) =>
        candidate.path ===
        sourceFile,
    );

  if (!file) {
    return null;
  }

  const resolvedImports =
    resolveImports(index);

  for (
    const importInfo of
      file.imports
  ) {
    const binding =
      importInfo.bindings?.find(
        (candidate) =>
          candidate.localName ===
          (qualifier ??
            expression),
      );

    const aliasMatches =
      importInfo.alias ===
      (qualifier ??
        expression);

    if (
      !binding &&
      !aliasMatches
    ) {
      continue;
    }

    const resolved =
      resolvedImports.find(
        (candidate) =>
          candidate.sourceFile ===
            sourceFile &&
          candidate.moduleSpecifier ===
            importInfo.moduleSpecifier &&
          candidate.status ===
            "internal" &&
          Boolean(
            candidate.targetFile,
          ),
      );

    if (
      !resolved?.targetFile
    ) {
      continue;
    }

    let targetName =
      terminalName;

    if (
      !qualifier &&
      binding &&
      binding.importedName !==
        "default"
    ) {
      targetName =
        binding.importedName;
    }

    const targetSymbol =
      findUniqueSymbol(
        index.symbols,
        (symbol) =>
          symbol.filePath ===
            resolved.targetFile &&
          symbol.name ===
            targetName &&
          symbol.kind !== "route",
      );

    if (targetSymbol) {
      return targetSymbol;
    }

    if (
      binding &&
      binding.importedName !==
        "default"
    ) {
      const importedSymbol =
        findUniqueSymbol(
          index.symbols,
          (symbol) =>
            symbol.filePath ===
              resolved.targetFile &&
            symbol.name ===
              binding.importedName &&
            symbol.kind !==
              "route",
        );

      if (importedSymbol) {
        return importedSymbol;
      }
    }
  }

  return null;
}

function resolveImportedFile(
  index: CodeIndex,
  sourceFile: string,
  expression: string,
): string | null {
  const localName =
    getQualifier(
      expression,
    ) ??
    expression;

  const file =
    index.files.find(
      (candidate) =>
        candidate.path ===
        sourceFile,
    );

  if (!file) {
    return null;
  }

  const resolvedImports =
    resolveImports(index);

  for (
    const importInfo of
      file.imports
  ) {
    const binding =
      importInfo.bindings?.find(
        (candidate) =>
          candidate.localName ===
          localName,
      );

    const aliasMatches =
      importInfo.alias ===
      localName;

    if (
      !binding &&
      !aliasMatches
    ) {
      continue;
    }

    const resolved =
      resolvedImports.find(
        (candidate) =>
          candidate.sourceFile ===
            sourceFile &&
          candidate.moduleSpecifier ===
            importInfo.moduleSpecifier &&
          candidate.status ===
            "internal" &&
          Boolean(
            candidate.targetFile,
          ),
      );

    if (
      resolved?.targetFile
    ) {
      return resolved.targetFile;
    }
  }

  return null;
}

function normalizeRoutePath(
  value: string,
): string {
  if (!value) {
    return "/";
  }

  if (value === "*") {
    return "/*";
  }

  const normalized =
    `/${value}`
      .replace(/\/+/g, "/");

  if (
    normalized.length > 1
  ) {
    return normalized.replace(
      /\/+$/,
      "",
    );
  }

  return normalized;
}

function joinRoutePath(
  mountPath: string,
  routePath: string,
): string {
  const normalizedMount =
    normalizeRoutePath(
      mountPath,
    );

  const normalizedRoute =
    normalizeRoutePath(
      routePath,
    );

  if (
    normalizedMount === "/"
  ) {
    return normalizedRoute;
  }

  if (
    normalizedRoute === "/"
  ) {
    return normalizedMount;
  }

  return `${normalizedMount}/${normalizedRoute
    .replace(/^\/+/, "")}`;
}

function buildMountPrefixes(
  index: CodeIndex,
): Map<string, string[]> {
  const mountPrefixes =
    new Map<
      string,
      string[]
    >();

  for (
    const relationship of
      index.relationships
  ) {
    if (
      relationship.kind !==
        "mounts"
    ) {
      continue;
    }

    const targetFile =
      resolveImportedFile(
        index,
        relationship.source,
        relationship.target,
      );

    if (!targetFile) {
      continue;
    }

    const mountPath =
      relationship.evidence
        ?.mountPath ??
      "";

    const prefixes =
      mountPrefixes.get(
        targetFile,
      ) ?? [];

    if (
      !prefixes.includes(
        mountPath,
      )
    ) {
      prefixes.push(
        mountPath,
      );
    }

    mountPrefixes.set(
      targetFile,
      prefixes,
    );
  }

  for (
    const [filePath, prefixes] of
      mountPrefixes.entries()
  ) {
    const uniquePrefixes =
      [
        ...new Set(
          prefixes.map(
            (prefix) =>
              normalizeRoutePath(
                prefix,
              ),
          ),
        ),
      ];

    mountPrefixes.set(
      filePath,
      uniquePrefixes,
    );
  }

  return mountPrefixes;
}

function updateRoutePaths(
  index: CodeIndex,
): void {
  const mountPrefixes =
    buildMountPrefixes(
      index,
    );

  for (
    const routeSymbol of
      index.symbols
  ) {
    if (
      routeSymbol.kind !==
        "route"
    ) {
      continue;
    }

    const prefixes =
      mountPrefixes.get(
        routeSymbol.filePath,
      );

    if (
      !prefixes ||
      prefixes.length === 0
    ) {
      continue;
    }

    const routeName =
      routeSymbol.name;

    const separator =
      routeName.indexOf(" ");

    if (separator === -1) {
      continue;
    }

    const method =
      routeName.slice(
        0,
        separator,
      );

    const localPath =
      routeName.slice(
        separator + 1,
      );

    const effectivePaths =
      prefixes.map(
        (prefix) =>
          joinRoutePath(
            prefix,
            localPath,
          ),
      );

    routeSymbol.routePaths =
      [
        ...new Set(
          effectivePaths,
        ),
      ];

    routeSymbol.signature =
      routeSymbol.routePaths.length ===
      1
        ? `${method} ${routeSymbol.routePaths[0]}`
        : `${method} ${routeSymbol.routePaths.join(", ")}`;
  }
}

export function resolveRouteRelationships(
  index: CodeIndex,
): CodeRelationship[] {
  updateRoutePaths(
    index,
  );

  const resolved:
    CodeRelationship[] =
    [];

  for (
    const relationship of
      index.relationships
  ) {
    if (
      relationship.kind !==
        "routes_to" &&
      relationship.kind !==
        "handles"
    ) {
      continue;
    }

    const routeSymbol =
      index.symbols.find(
        (symbol) =>
          symbol.id ===
            relationship.source &&
          symbol.kind === "route",
      );

    if (!routeSymbol) {
      continue;
    }

    const targetSymbol =
      resolveRouteTarget(
        index,
        routeSymbol.filePath,
        relationship.target,
      );

    if (!targetSymbol) {
      resolved.push({
        ...relationship,
        confidence:
          Math.min(
            relationship.confidence ??
              0.5,
            0.35,
          ),
      });

      continue;
    }

    resolved.push({
      ...relationship,
      target:
        targetSymbol.id,
      confidence:
        relationship.confidence ??
        0.9,
    });
  }

  return resolved;
}