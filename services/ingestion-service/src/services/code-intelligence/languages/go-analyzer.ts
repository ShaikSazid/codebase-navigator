import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const goAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: ["go"],
    callNodeKinds: [
      "call_expression",
    ],
    instantiationNodeKinds: [],
    returnNodeKinds: [
      "return_statement",
    ],
    extendsNodeKinds: [],
    implementsNodeKinds: [],
    callFields: [
      "function",
    ],
    instantiationFields: [],
    returnFields: [
      "expression_list",
    ],
    extendsFields: [],
    implementsFields: [],
  });