import path from "node:path";
import type {
  DependencyEdge,
  FileNode,
  RepoFileIndex,
} from "../types/repo.js";

export function buildRepositoryIndex(
  repositoryIndex: string,
  files: Array<{
    path: string;
    content: string;
  }>,
): RepoFileIndex {
  const fileNodes: FileNode[] = files.map((file) => ({
    path: file.path,
    imports: extractImports(file.content),
  }));

  const dependencyEdges = buildDependencyEdges(fileNodes);

  return {
    repositoryIndex,
    files: fileNodes,
    dependencyEdges,
  };
}

function extractImports(content: string): string[] {
  const imports: string[] = [];

  const importRegex =
    /import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const requireRegex =
    /require\s*\(\s*["']([^"']+)["']\s*\)/g;

  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
}

function buildDependencyEdges(fileNodes: FileNode[]): DependencyEdge[] {
  const repositoryFiles = new Set(fileNodes.map((file) => file.path));

  const edges: DependencyEdge[] = [];

  for (const file of fileNodes) {
    for (const importedPath of file.imports) {
      const target = resolveInternalImport(
        file.path,
        importedPath,
        repositoryFiles,
      );

      if (!target) {
        continue;
      }

      edges.push({
        source: file.path,
        target,
      });
    }
  }

  return edges;
}

function resolveInternalImport(
  sourceFile: string,
  importedPath: string,
  repositoryFiles: Set<string>,
): string | null {
  // Ignore external packages such as express, react, axios, etc.
  if (!importedPath.startsWith(".")) {
    return null;
  }

  const sourceDirectory = path.posix.dirname(sourceFile);

  const resolvedPath = path.posix.normalize(
    path.posix.join(sourceDirectory, importedPath),
  );

  const candidates = getCandidatePaths(resolvedPath);

  for (const candidate of candidates) {
    if (repositoryFiles.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getCandidatePaths(importPath: string): string[] {
  const extension = path.posix.extname(importPath);

  // TypeScript projects commonly use .js in import statements
  // even though the actual source file is .ts.
  if (extension === ".js") {
    return [
      importPath,
      `${importPath.slice(0, -3)}.ts`,
      `${importPath.slice(0, -3)}.tsx`,
      `${importPath.slice(0, -3)}.js`,
      `${importPath.slice(0, -3)}.jsx`,
    ];
  }

  if (extension === ".ts") {
    return [
      importPath,
      `${importPath.slice(0, -3)}.tsx`,
      `${importPath.slice(0, -3)}.js`,
    ];
  }

  if (extension === ".tsx") {
    return [
      importPath,
      `${importPath.slice(0, -4)}.ts`,
      `${importPath.slice(0, -4)}.js`,
    ];
  }

  // Extensionless imports such as:
  // import "./auth"
  return [
    importPath,
    `${importPath}.ts`,
    `${importPath}.tsx`,
    `${importPath}.js`,
    `${importPath}.jsx`,
  ];
}