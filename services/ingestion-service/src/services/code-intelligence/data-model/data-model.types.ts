export type DataModelKind =
  | "model"
  | "schema"
  | "entity"
  | "record";

export interface DataModelField {
  name: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
  nullable?: boolean;
  array?: boolean;
  defaultValue?: string;
  references?: string;
  startLine?: number;
  endLine?: number;
}

export interface DataModel {
  id: string;
  name: string;
  kind: DataModelKind;
  filePath: string;
  framework?: string;
  tableName?: string;
  collectionName?: string;
  fields: DataModelField[];
  startLine: number;
  endLine: number;
  symbolId: string;
  schemaSymbolId?: string;
}
