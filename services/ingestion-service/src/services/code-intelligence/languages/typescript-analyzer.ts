import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const typescriptAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: [
      "typescript",
      "tsx",
    ],
    callNodeKinds: [
      "call_expression",
    ],
    instantiationNodeKinds: [
      "new_expression",
    ],
    returnNodeKinds: [
      "return_statement",
    ],
    extendsNodeKinds: [
      "class_declaration",
      "interface_declaration",
    ],
    implementsNodeKinds: [
      "class_declaration",
    ],
    callFields: [
      "function",
      "name",
    ],
    instantiationFields: [
      "constructor",
      "type",
    ],
    returnFields: [
      "argument",
      "value",
    ],
    extendsFields: [
      "superclass",
      "extends",
    ],
    implementsFields: [
      "implements",
      "interfaces",
    ],
  });