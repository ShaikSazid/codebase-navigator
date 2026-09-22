import type {
  CodeSymbol,
} from "./indexer.types.js";

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
  childByFieldName(name: string): AstNode | null;
}

interface AstTree {
  rootNode(): AstNode;
}

export interface RelationshipCandidate {
  filePath: string;
  sourceSymbolId?: string;
  targetName: string;
  kind: "calls" | "instantiates";
  startLine: number;
  endLine: number;
}

const CALL_NODE_KINDS = new Set([
  "call_expression",
  "call",
  "method_invocation",
  "invocation_expression",
  "method_call",
]);

const INSTANTIATION_NODE_KINDS = new Set([
  "new_expression",
  "object_creation_expression",
]);

function getStartLine(node: AstNode): number {
  /*
   * Tree-sitter rows are zero-based.
   * Keep zero-based here for symbol matching.
   */
  return node.startPosition().row;
}

function getEndLine(node: AstNode): number {
  return node.endPosition().row;
}

function getEvidenceStartLine(node: AstNode): number {
  /*
   * UI-facing line numbers are one-based.
   */
  return node.startPosition().row + 1;
}

function getEvidenceEndLine(node: AstNode): number {
  return node.endPosition().row + 1;
}

function getNodeText(
  node: AstNode,
  source: string,
): string {
  const sourceBytes = Buffer.from(source, "utf8");

  return sourceBytes
    .subarray(
      node.startByte(),
      node.endByte(),
    )
    .toString("utf8")
    .trim();
}

function getCalleeNode(
  node: AstNode,
): AstNode | null {
  /*
   * JavaScript / TypeScript:
   *
   * call_expression
   *   function: identifier
   *   arguments
   */
  const functionNode =
    node.childByFieldName("function");

  if (functionNode) {
    return functionNode;
  }

  /*
   * Other grammars may expose the callable
   * through "name".
   */
  const nameNode =
    node.childByFieldName("name");

  if (nameNode) {
    return nameNode;
  }

  /*
   * Some grammars use "constructor" or "type"
   * for object creation.
   */
  const constructorNode =
    node.childByFieldName("constructor");

  if (constructorNode) {
    return constructorNode;
  }

  const typeNode =
    node.childByFieldName("type");

  if (typeNode) {
    return typeNode;
  }

  return null;
}

function normalizeTargetName(
  targetName: string,
): string {
  return targetName
    .trim()
    .replace(/\?\./g, ".")
    .replace(/^this\./, "")
    .replace(/^self\./, "");
}

function findEnclosingSymbol(
  node: AstNode,
  symbols: CodeSymbol[],
): CodeSymbol | undefined {
  const line = getStartLine(node);

  const containing = symbols.filter(
    (symbol) =>
      line >= symbol.startLine &&
      line <= symbol.endLine,
  );

  /*
   * If symbols are nested, choose the smallest
   * enclosing symbol.
   */
  containing.sort(
    (a, b) =>
      (a.endLine - a.startLine) -
      (b.endLine - b.startLine),
  );

  return containing[0];
}

function walk(
  node: AstNode,
  filePath: string,
  source: string,
  symbols: CodeSymbol[],
  candidates: RelationshipCandidate[],
): void {
  const kind = node.kind();

  if (CALL_NODE_KINDS.has(kind)) {
    const calleeNode =
      getCalleeNode(node);

    if (calleeNode) {
      const targetName =
        normalizeTargetName(
          getNodeText(
            calleeNode,
            source,
          ),
        );

      if (targetName) {
        const sourceSymbol =
          findEnclosingSymbol(
            node,
            symbols,
          );

        candidates.push({
          filePath,
          sourceSymbolId:
            sourceSymbol?.id,
          targetName,
          kind: "calls",
          startLine:
            getEvidenceStartLine(node),
          endLine:
            getEvidenceEndLine(node),
        });
      }
    }
  }

  if (
    INSTANTIATION_NODE_KINDS.has(kind)
  ) {
    const calleeNode =
      getCalleeNode(node);

    if (calleeNode) {
      const targetName =
        normalizeTargetName(
          getNodeText(
            calleeNode,
            source,
          ),
        );

      if (targetName) {
        const sourceSymbol =
          findEnclosingSymbol(
            node,
            symbols,
          );

        candidates.push({
          filePath,
          sourceSymbolId:
            sourceSymbol?.id,
          targetName,
          kind: "instantiates",
          startLine:
            getEvidenceStartLine(node),
          endLine:
            getEvidenceEndLine(node),
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
        filePath,
        source,
        symbols,
        candidates,
      );
    }
  }
}

export function extractRelationshipCandidates(
  input: {
    filePath: string;
    source: string;
    tree: unknown;
    symbols: CodeSymbol[];
  },
): RelationshipCandidate[] {
  const tree =
    input.tree as AstTree;

  if (
    !tree ||
    typeof tree.rootNode !== "function"
  ) {
    return [];
  }

  const root =
    tree.rootNode();

  const candidates:
    RelationshipCandidate[] = [];

  walk(
    root,
    input.filePath,
    input.source,
    input.symbols,
    candidates,
  );

  return candidates;
}