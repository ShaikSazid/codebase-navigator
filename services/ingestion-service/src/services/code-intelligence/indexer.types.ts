import type { DataModel } from "./data-model/data-model.types.js";

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
  | "route"
  | "unknown"
  | "model"
  | "schema"
  | "field"

export type CodeRelationshipKind =
  | "imports"
  | "defines"
  | "references"
  | "calls"
  | "implements"
  | "extends"
  | "routes_to"
  | "handles"
  | "mounts"
  | "publishes"
  | "consumes"
  | "queries"
  | "writes"
  | "reads"
  | "instantiates"
  | "returns"
  | "depends_on"
  | "uses_schema"
| "has_field"

export interface ImportBinding {
  importedName: string;
  localName: string;
}

export interface NormalizedImport {
  raw: string;
  moduleSpecifier: string;
  importedNames: string[];
  alias?: string;
  isWildcard: boolean;
  bindings?: ImportBinding[];
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
  routePaths?: string[];
}

export interface CodeRelationship {
  source: string;
  target: string;
  kind: CodeRelationshipKind;
  confidence?: number;
  evidence?: {
    filePath: string;
    startLine: number;
    endLine: number;
    mountPath?: string;
  };
}

export interface CodeIndex {
  repositoryId: string;
  files: CodeFile[];
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
  dataModels: DataModel[];
}

export interface RepositorySourceFile {
  filePath: string;
  content: string;
}