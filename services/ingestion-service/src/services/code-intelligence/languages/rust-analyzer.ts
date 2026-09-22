import {
  TreeSitterLanguageAnalyzer,
} from "./tree-sitter-analyzer.js";

export const rustAnalyzer =
  new TreeSitterLanguageAnalyzer({
    languages: ["rust"],
    callNodeKinds: [
      "call_expression",
    ],
    instantiationNodeKinds: [],
    returnNodeKinds: [
      "return_expression",
    ],
    extendsNodeKinds: [],
    implementsNodeKinds: [
      "impl_item",
    ],
    callFields: [
      "function",
    ],
    instantiationFields: [],
    returnFields: [
      "value",
    ],
    extendsFields: [],
    implementsFields: [
      "trait",
    ],
  });