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

function getNodeText(
  node: AstNode,
  source: string,
): string {
  const bytes =
    Buffer.from(
      source,
      "utf8",
    );

  return bytes
    .subarray(
      node.startByte(),
      node.endByte(),
    )
    .toString("utf8")
    .trim();
}

function findSourceSymbol(
  node: AstNode,
  symbols: CodeSymbol[],
): CodeSymbol | undefined {
  const line =
    node.startPosition().row;

  const containing =
    symbols.filter(
      (symbol) =>
        line >= symbol.startLine &&
        line <= symbol.endLine,
    );

  containing.sort(
    (a, b) =>
      a.endLine -
      a.startLine -
      (b.endLine -
        b.startLine),
  );

  return containing[0];
}

function walk(
  node: AstNode,
  parentKind: string | null,
  input: LanguageAnalyzerInput,
  relationships: CodeRelationship[],
): void {
  const kind =
    node.kind();

  if (
    kind === "identifier" &&
    parentKind ===
      "body_statement"
  ) {
    const targetName =
      getNodeText(
        node,
        input.source,
      );

    const sourceSymbol =
      findSourceSymbol(
        node,
        input.symbols,
      );

    if (
      targetName &&
      sourceSymbol
    ) {
      relationships.push({
        source:
          sourceSymbol.id,
        target:
          targetName,
        kind: "calls",
        confidence: 0.55,
        evidence: {
          filePath:
            input.filePath,
          startLine:
            node.startPosition().row +
            1,
          endLine:
            node.endPosition().row +
            1,
        },
      });
    }
  }

  if (
    kind === "call" ||
    kind === "method_call" ||
    kind === "command"
  ) {
    const callee =
      node.childByFieldName(
        "method",
      ) ??
      node.childByFieldName(
        "name",
      );

    if (callee) {
      const targetName =
        getNodeText(
          callee,
          input.source,
        );

      const sourceSymbol =
        findSourceSymbol(
          node,
          input.symbols,
        );

      if (
        targetName &&
        sourceSymbol
      ) {
        relationships.push({
          source:
            sourceSymbol.id,
          target:
            targetName,
          kind: "calls",
          confidence: 0.8,
          evidence: {
            filePath:
              input.filePath,
            startLine:
              node.startPosition()
                .row + 1,
            endLine:
              node.endPosition()
                .row + 1,
          },
        });
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
        kind,
        input,
        relationships,
      );
    }
  }
}

export class RubyLanguageAnalyzer
  implements LanguageAnalyzer
{
  canAnalyze(
    language: string,
  ): boolean {
    return language === "ruby";
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
      null,
      input,
      relationships,
    );

    return relationships;
  }
}

export const rubyAnalyzer =
  new RubyLanguageAnalyzer();