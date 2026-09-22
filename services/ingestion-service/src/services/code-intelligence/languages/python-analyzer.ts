import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const pythonAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: ["python"],
    callNodeKinds: [
      "call",
    ],
    instantiationNodeKinds: [],
    returnNodeKinds: [
      "return_statement",
    ],
    extendsNodeKinds: [
      "class_definition",
    ],
    implementsNodeKinds: [],
    callFields: [
      "function",
    ],
    instantiationFields: [],
    returnFields: [
      "expression",
    ],
    extendsFields: [
      "superclasses",
    ],
    implementsFields: [],
  });