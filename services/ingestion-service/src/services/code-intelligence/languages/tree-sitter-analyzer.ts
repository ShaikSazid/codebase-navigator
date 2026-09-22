import type {
  CodeRelationship,
  CodeSymbol,
} from "../indexer.types.js";

import type {
  LanguageAnalyzer,
  LanguageAnalyzerInput,
} from "./language-analyzer.js";

interface AstPosition {
  row: number;
  column: number;
}

interface AstNode {
  kind(): string;
  startByte(): number;
  endByte(): number;
  startPosition(): AstPosition;
  endPosition(): AstPosition;
  namedChildCount(): number;
  namedChild(index: number): AstNode | null;
  childByFieldName(
    name: string,
  ): AstNode | null;
}

interface AstTree {
  rootNode(): AstNode;
}

export interface TreeSitterAnalyzerConfig {
  languages: string[];
  callNodeKinds: string[];
  instantiationNodeKinds: string[];
  returnNodeKinds: string[];
  extendsNodeKinds: string[];
  implementsNodeKinds: string[];
  callFields: string[];
  instantiationFields: string[];
  returnFields: string[];
  extendsFields: string[];
  implementsFields: string[];
}

function getNodeText(
  node: AstNode,
  source: string,
): string {
  return Buffer.from(
    source,
    "utf8",
  )
    .subarray(
      node.startByte(),
      node.endByte(),
    )
    .toString("utf8")
    .trim();
}

function getLine(
  node: AstNode,
): number {
  return node.startPosition().row + 1;
}

function getEndLine(
  node: AstNode,
): number {
  return node.endPosition().row + 1;
}

function normalizeTarget(
  value: string,
): string {
  return value
    .trim()
    .replace(/\?\./g, ".")
    .replace(/^this\./, "")
    .replace(/^self\./, "")
    .replace(/::/g, ".");
}

function getFieldNode(
  node: AstNode,
  fields: string[],
): AstNode | null {
  for (const field of fields) {
    const child =
      node.childByFieldName(field);

    if (child) {
      return child;
    }
  }

  return null;
}

function findSourceSymbol(
  node: AstNode,
  symbols: CodeSymbol[],
): CodeSymbol | undefined {
  const line =
    node.startPosition().row;

  const candidates =
    symbols.filter(
      (symbol) =>
        line >= symbol.startLine &&
        line <= symbol.endLine,
    );

  candidates.sort(
    (a, b) =>
      a.endLine -
      a.startLine -
      (b.endLine -
        b.startLine),
  );

  return candidates[0];
}

function createRelationship(
  sourceSymbol: CodeSymbol,
  target: string,
  kind: CodeRelationship["kind"],
  node: AstNode,
  filePath: string,
  confidence: number,
): CodeRelationship {
  return {
    source: sourceSymbol.id,
    target,
    kind,
    confidence,
    evidence: {
      filePath,
      startLine: getLine(node),
      endLine: getEndLine(node),
    },
  };
}

function walk(
  node: AstNode,
  input: LanguageAnalyzerInput,
  config: TreeSitterAnalyzerConfig,
  relationships: CodeRelationship[],
): void {
  const nodeKind =
    node.kind();

  const sourceSymbol =
    findSourceSymbol(
      node,
      input.symbols,
    );

  if (
    sourceSymbol &&
    config.callNodeKinds.includes(
      nodeKind,
    )
  ) {
    const targetNode =
      getFieldNode(
        node,
        config.callFields,
      );

    if (targetNode) {
      const target =
        normalizeTarget(
          getNodeText(
            targetNode,
            input.source,
          ),
        );

      if (target) {
        relationships.push(
          createRelationship(
            sourceSymbol,
            target,
            "calls",
            node,
            input.filePath,
            0.8,
          ),
        );
      }
    }
  }

  if (
    sourceSymbol &&
    config.instantiationNodeKinds.includes(
      nodeKind,
    )
  ) {
    const targetNode =
      getFieldNode(
        node,
        config.instantiationFields,
      );

    if (targetNode) {
      const target =
        normalizeTarget(
          getNodeText(
            targetNode,
            input.source,
          ),
        );

      if (target) {
        relationships.push(
          createRelationship(
            sourceSymbol,
            target,
            "instantiates",
            node,
            input.filePath,
            0.85,
          ),
        );
      }
    }
  }

  if (
    sourceSymbol &&
    config.returnNodeKinds.includes(
      nodeKind,
    )
  ) {
    const targetNode =
      getFieldNode(
        node,
        config.returnFields,
      );

    if (targetNode) {
      const target =
        normalizeTarget(
          getNodeText(
            targetNode,
            input.source,
          ),
        );

      if (target) {
        relationships.push(
          createRelationship(
            sourceSymbol,
            target,
            "returns",
            node,
            input.filePath,
            0.65,
          ),
        );
      }
    }
  }

  if (
    sourceSymbol &&
    config.extendsNodeKinds.includes(
      nodeKind,
    )
  ) {
    const targetNode =
      getFieldNode(
        node,
        config.extendsFields,
      );

    if (targetNode) {
      const target =
        normalizeTarget(
          getNodeText(
            targetNode,
            input.source,
          ),
        );

      if (target) {
        relationships.push(
          createRelationship(
            sourceSymbol,
            target,
            "extends",
            node,
            input.filePath,
            0.9,
          ),
        );
      }
    }
  }

  if (
    sourceSymbol &&
    config.implementsNodeKinds.includes(
      nodeKind,
    )
  ) {
    const targetNode =
      getFieldNode(
        node,
        config.implementsFields,
      );

    if (targetNode) {
      const target =
        normalizeTarget(
          getNodeText(
            targetNode,
            input.source,
          ),
        );

      if (target) {
        relationships.push(
          createRelationship(
            sourceSymbol,
            target,
            "implements",
            node,
            input.filePath,
            0.9,
          ),
        );
      }
    }
  }

  for (
    let i = 0;
    i < node.namedChildCount();
    i++
  ) {
    const child =
      node.namedChild(i);

    if (child) {
      walk(
        child,
        input,
        config,
        relationships,
      );
    }
  }
}

export class TreeSitterLanguageAnalyzer
  implements LanguageAnalyzer
{
  constructor(
    private readonly config:
      TreeSitterAnalyzerConfig,
  ) {}

  canAnalyze(
    language: string,
  ): boolean {
    return this.config.languages.includes(
      language,
    );
  }

  extractRelationships(
    input: LanguageAnalyzerInput,
  ): CodeRelationship[] {
    const tree =
      input.tree as AstTree;

    if (
      !tree ||
      typeof tree.rootNode !==
        "function"
    ) {
      return [];
    }

    const relationships:
      CodeRelationship[] = [];

    walk(
      tree.rootNode(),
      input,
      this.config,
      relationships,
    );

    return relationships;
  }
}