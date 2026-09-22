import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const javascriptAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: ["javascript"],
    callNodeKinds: [
      "call_expression",
    ],
    instantiationNodeKinds: [
      "new_expression",
    ],
    returnNodeKinds: [
      "return_statement",
    ],
    extendsNodeKinds: [],
    implementsNodeKinds: [],
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
    extendsFields: [],
    implementsFields: [],
  });