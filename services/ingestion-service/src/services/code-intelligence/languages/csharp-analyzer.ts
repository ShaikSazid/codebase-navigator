import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const csharpAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: ["csharp"],
    callNodeKinds: [
      "invocation_expression",
    ],
    instantiationNodeKinds: [
      "object_creation_expression",
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
      "struct_declaration",
    ],
    callFields: [
      "function",
    ],
    instantiationFields: [
      "type",
    ],
    returnFields: [
      "expression",
    ],
    extendsFields: [
      "base_list",
    ],
    implementsFields: [
      "base_list",
    ],
  });