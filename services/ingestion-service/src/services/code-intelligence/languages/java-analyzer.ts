import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const javaAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: ["java"],
    callNodeKinds: [
      "method_invocation",
      "explicit_constructor_invocation",
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
    ],
    callFields: [
      "name",
    ],
    instantiationFields: [
      "type",
    ],
    returnFields: [
      "expression",
    ],
    extendsFields: [
      "superclass",
    ],
    implementsFields: [
      "interfaces",
    ],
  });