import type {
  CodeIndex,
  CodeRelationship,
  NormalizedImport,
} from "./indexer.types.js";

import {
  resolveImports,
  type ResolvedImport,
} from "./import-resolver.js";

const QUERY_METHODS =
  new Set([
    "find",
    "findOne",
    "findById",
    "findByIds",
    "count",
    "countDocuments",
    "estimatedDocumentCount",
    "exists",
    "distinct",
    "aggregate",
  ]);

const WRITE_METHODS =
  new Set([
    "create",
    "insertMany",
    "insertOne",
    "updateOne",
    "updateMany",
    "replaceOne",
    "findOneAndUpdate",
    "findByIdAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "findByIdAndDelete",
    "deleteOne",
    "deleteMany",
    "bulkWrite",
    "register",
    "deregister",
    "save",
    "remove",
    "deleteOne",
  ]);

const INSTANCE_WRITE_METHODS =
  new Set([
    "save",
    "remove",
    "deleteOne",
    "updateOne",
    "replaceOne",
  ]);

function getSourceSymbol(
  index: CodeIndex,
  relationship: CodeRelationship,
) {
  return index.symbols.find(
    (symbol) =>
      symbol.id ===
      relationship.source,
  );
}

function getQualifier(
  value: string,
): string | null {
  const normalized =
    value
      .replace(/\?\./g, ".")
      .replace(/::/g, ".");

  const match =
    normalized.match(
      /^([A-Za-z_$][\w$]*)\./,
    );

  return match?.[1] ?? null;
}

function getMethodName(
  value: string,
): string | null {
  const normalized =
    value
      .replace(/\?\./g, ".")
      .replace(/::/g, ".");

  const match =
    normalized.match(
      /^[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)/,
    );

  return match?.[1] ?? null;
}

function getReceiverName(
  value: string,
): string | null {
  const normalized =
    value
      .replace(/\?\./g, ".")
      .replace(/::/g, ".");

  const match =
    normalized.match(
      /^([A-Za-z_$][\w$]*)\./,
    );

  return match?.[1] ?? null;
}

function normalizeModelName(
  receiver: string,
): string {
  const withoutNewPrefix =
    receiver.replace(
      /^new([A-Z])/,
      "$1",
    );

  if (
    withoutNewPrefix.length ===
    0
  ) {
    return withoutNewPrefix;
  }

  return (
    withoutNewPrefix[0]?.toUpperCase() ??
    ""
  ) +
    withoutNewPrefix.slice(1);
}

function isModelFile(
  filePath: string,
): boolean {
  const normalized =
    filePath.replace(
      /\\/g,
      "/",
    );

  return (
    normalized.startsWith(
      "models/",
    ) ||
    normalized.includes(
      "/models/",
    ) ||
    normalized.endsWith(
      ".model.js",
    ) ||
    normalized.endsWith(
      ".model.ts",
    ) ||
    normalized.endsWith(
      ".model.tsx",
    )
  );
}

function getImportsForFile(
  index: CodeIndex,
  filePath: string,
): NormalizedImport[] {
  return (
    index.files.find(
      (file) =>
        file.path ===
        filePath,
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
        item.sourceFile ===
          sourceFile &&
        item.moduleSpecifier ===
          moduleSpecifier &&
        item.status ===
          "internal" &&
        Boolean(
          item.targetFile,
        ),
    ) ?? null
  );
}

function resolveImportedFile(
  index: CodeIndex,
  resolvedImports: ResolvedImport[],
  sourceFile: string,
  localName: string,
): string | null {
  const imports =
    getImportsForFile(
      index,
      sourceFile,
    );

  for (const importInfo of imports) {
    const matchesBinding =
      importInfo.bindings?.some(
        (binding) =>
          binding.localName ===
          localName,
      ) ?? false;

    const matchesAlias =
      importInfo.alias ===
      localName;

    const matchesImportedName =
      importInfo.importedNames.includes(
        localName,
      );

    if (
      !matchesBinding &&
      !matchesAlias &&
      !matchesImportedName
    ) {
      continue;
    }

    const resolved =
      findResolvedImport(
        resolvedImports,
        sourceFile,
        importInfo.moduleSpecifier,
      );

    if (
      resolved?.targetFile &&
      isModelFile(
        resolved.targetFile,
      )
    ) {
      return resolved.targetFile;
    }
  }

  return null;
}

function createRelationship(
  relationship: CodeRelationship,
  targetFile: string,
  kind:
    | "queries"
    | "writes"
    | "reads"
    | "instantiates",
  confidence = 0.9,
): CodeRelationship {
  return {
    source:
      relationship.source,
    target:
      targetFile,
    kind,
    confidence,
    evidence:
      relationship.evidence,
  };
}

function deduplicate(
  relationships: CodeRelationship[],
): CodeRelationship[] {
  const seen =
    new Set<string>();

  return relationships.filter(
    (relationship) => {
      const key = [
        relationship.source,
        relationship.target,
        relationship.kind,
      ].join("|");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

function resolveModelForReceiver(
  index: CodeIndex,
  resolvedImports: ResolvedImport[],
  sourceFile: string,
  receiver: string,
): string | null {
  const direct =
    resolveImportedFile(
      index,
      resolvedImports,
      sourceFile,
      receiver,
    );

  if (direct) {
    return direct;
  }

  const normalized =
    normalizeModelName(
      receiver,
    );

  if (
    normalized !== receiver
  ) {
    const fromNormalized =
      resolveImportedFile(
        index,
        resolvedImports,
        sourceFile,
        normalized,
      );

    if (fromNormalized) {
      return fromNormalized;
    }
  }

  const imports =
    getImportsForFile(
      index,
      sourceFile,
    );

  for (const importInfo of imports) {
    const localNames =
      new Set<string>();

    if (importInfo.alias) {
      localNames.add(
        importInfo.alias,
      );
    }

    for (const binding of
      importInfo.bindings ?? []) {
      localNames.add(
        binding.localName,
      );
    }

    for (const importedName of
      importInfo.importedNames) {
      localNames.add(
        importedName,
      );
    }

    for (const localName of
      localNames) {
      const localNormalized =
        normalizeModelName(
          localName,
        );

      if (
        localNormalized !==
        normalized
      ) {
        continue;
      }

      const resolved =
        findResolvedImport(
          resolvedImports,
          sourceFile,
          importInfo.moduleSpecifier,
        );

      if (
        resolved?.targetFile &&
        isModelFile(
          resolved.targetFile,
        )
      ) {
        return resolved.targetFile;
      }
    }
  }

  return null;
}

export function resolveDataAccessRelationships(
  index: CodeIndex,
): CodeRelationship[] {
  const resolvedImports =
    resolveImports(index);

  const relationships: CodeRelationship[] =
    [];

  for (const relationship of
    index.relationships) {
    if (
      relationship.kind !==
        "instantiates" &&
      relationship.kind !==
        "calls"
    ) {
      continue;
    }

    const sourceSymbol =
      getSourceSymbol(
        index,
        relationship,
      );

    if (!sourceSymbol) {
      continue;
    }

    const sourceFile =
      sourceSymbol.filePath;

    if (
      relationship.kind ===
      "instantiates"
    ) {
      const modelName =
        String(
          relationship.target,
        );

      const modelFile =
        resolveModelForReceiver(
          index,
          resolvedImports,
          sourceFile,
          modelName,
        );

      if (!modelFile) {
        continue;
      }

      relationships.push(
        createRelationship(
          relationship,
          modelFile,
          "instantiates",
          0.95,
        ),
      );

      continue;
    }

    const target =
      String(
        relationship.target,
      );

    const receiver =
      getReceiverName(
        target,
      );

    const method =
      getMethodName(
        target,
      );

    if (
      receiver &&
      method
    ) {
      const modelFile =
        resolveModelForReceiver(
          index,
          resolvedImports,
          sourceFile,
          receiver,
        );

      if (
        modelFile &&
        QUERY_METHODS.has(
          method,
        )
      ) {
        relationships.push(
          createRelationship(
            relationship,
            modelFile,
            "queries",
            0.92,
          ),
        );

        continue;
      }

      if (
        modelFile &&
        WRITE_METHODS.has(
          method,
        )
      ) {
        relationships.push(
          createRelationship(
            relationship,
            modelFile,
            "writes",
            0.92,
          ),
        );

        continue;
      }

      if (
        modelFile &&
        INSTANCE_WRITE_METHODS.has(
          method,
        )
      ) {
        relationships.push(
          createRelationship(
            relationship,
            modelFile,
            "writes",
            0.85,
          ),
        );
      }
    }
  }

  return deduplicate(
    relationships,
  );
}