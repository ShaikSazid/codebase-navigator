import type {
  DependencyEdge,
  FileNode,
  RepoFileIndex,
  RepositorySymbol,
} from "../types/repo.js";

import {
  indexRepositoryFiles,
} from "./code-intelligence/code-indexer.service.js";

import type {
  CodeRelationship,
} from "./code-intelligence/indexer.types.js";

export interface RepositoryFileContext {
  filePath: string;
  language?: string;
  dependencies: string[];
  usedBy: string[];
  symbols: RepositorySymbol[];
}

export function buildRepositoryIndex(
  repositoryIndex: string,
  files: Array<{
    path: string;
    content: string;
  }>,
): RepoFileIndex {
  /*
   * Convert the existing repository file shape
   * into the code-intelligence input shape.
   */
  const codeIndex = indexRepositoryFiles(
    repositoryIndex,
    files.map((file) => ({
      filePath: file.path,
      content: file.content,
    })),
  );

  /*
   * Quick lookup for language metadata.
   */
  const languageByFile = new Map<
    string,
    string
  >();

  for (const file of codeIndex.files) {
    languageByFile.set(
      file.path,
      file.language,
    );
  }

  /*
   * Quick lookup for symbols defined in each file.
   */
  const symbolsByFile = new Map<
    string,
    RepositorySymbol[]
  >();

  for (const symbol of codeIndex.symbols) {
    const symbols =
      symbolsByFile.get(symbol.filePath) ?? [];

    symbols.push({
      name: symbol.name,
      kind: symbol.kind,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      signature: symbol.signature,
    });

    symbolsByFile.set(
      symbol.filePath,
      symbols,
    );
  }

  /*
   * Store normalized imports on each file.
   *
   * This includes the raw module specifier,
   * not only successfully resolved internal files.
   */
  const importsByFile = new Map<
    string,
    string[]
  >();

  for (const file of codeIndex.files) {
    importsByFile.set(
      file.path,
      unique(
        file.imports.map(
          (importInfo) =>
            importInfo.moduleSpecifier,
        ),
      ),
    );
  }

  const fileNodes: FileNode[] = files.map(
    (file) => ({
      path: file.path,

      imports:
        importsByFile.get(file.path) ?? [],

      language:
        languageByFile.get(file.path),

      symbols:
        symbolsByFile.get(file.path) ?? [],
    }),
  );
  const dependencyEdges =
    buildDependencyEdges(
      codeIndex.relationships,
    );

  return {
    repositoryIndex,
    files: fileNodes,
    dependencyEdges,
  };
}

export function getRepositoryFileContext(
  repositoryIndex: RepoFileIndex,
  filePath: string,
): RepositoryFileContext | null {
  const fileNode =
    repositoryIndex.files.find(
      (file) => file.path === filePath,
    );

  if (!fileNode) {
    return null;
  }

  const dependencies = unique(
    repositoryIndex.dependencyEdges
      .filter(
        (edge: DependencyEdge) =>
          edge.source === filePath,
      )
      .map(
        (edge: DependencyEdge) =>
          edge.target,
      ),
  );

  const usedBy = unique(
    repositoryIndex.dependencyEdges
      .filter(
        (edge: DependencyEdge) =>
          edge.target === filePath,
      )
      .map(
        (edge: DependencyEdge) =>
          edge.source,
      ),
  );

  return {
    filePath,

    language:
      fileNode.language,

    dependencies,

    usedBy,

    symbols:
      fileNode.symbols ?? [],
  };
}

function buildDependencyEdges(
  relationships: CodeRelationship[],
): DependencyEdge[] {
  const seen = new Set<string>();

  const edges: DependencyEdge[] = [];

  for (const relationship of relationships) {
    if (relationship.kind !== "imports") {
      continue;
    }

    const key =
      `${relationship.source}->${relationship.target}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    edges.push({
      source: relationship.source,
      target: relationship.target,
    });
  }

  return edges;
}

function unique(
  values: string[],
): string[] {
  return [
    ...new Set(values),
  ];
}