export type CodeSymbolKind =
  | "file"
  | "class"
  | "function"
  | "method"
  | "interface"
  | "struct"
  | "enum"
  | "trait"
  | "type"
  | "variable"
  | "constant"
  | "unknown";

export type CodeRelationshipKind =
  | "imports"
  | "defines"
  | "references"
  | "implements"
  | "extends";

export interface NormalizedImport {
  raw: string;
  moduleSpecifier: string;
  importedNames: string[];
  alias?: string;
  isWildcard: boolean;
  startLine?: number;
  endLine?: number;
}

export interface CodeFile {
  path: string;
  language: string;
  lineCount: number;
  imports: NormalizedImport[];
}

export interface CodeSymbol {
  id: string;
  name: string;
  kind: CodeSymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
}

export interface CodeRelationship {
  source: string;
  target: string;
  kind: CodeRelationshipKind;
}

export interface CodeIndex {
  repositoryId: string;
  files: CodeFile[];
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
}

export interface RepositorySourceFile {
  filePath: string;
  content: string;
}