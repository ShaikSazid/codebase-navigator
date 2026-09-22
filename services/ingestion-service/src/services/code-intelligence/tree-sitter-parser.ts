import treeSitter from "@xberg-io/tree-sitter-language-pack";

const { process, getParser } = treeSitter;

export interface ParsedFile {
  language: string;

  structure: unknown[];
  imports: unknown[];
  exports: unknown[];
  symbols: unknown[];
  diagnostics: unknown[];

  metrics: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    totalBytes: number;
    nodeCount: number;
    errorCount: number;
    maxDepth: number;
  };
}

export interface ParsedAstFile {
  language: string;
  tree: unknown;
}

interface AstPosition {
  row: number;
  column: number;
}

interface AstNode {
  kind(): string;
  namedChildCount(): number;
  namedChild(index: number): AstNode | null;
  childByFieldName(name: string): AstNode | null;
  startByte(): number;
  endByte(): number;
  startPosition(): AstPosition;
  endPosition(): AstPosition;
}

interface AstTree {
  rootNode(): AstNode;
}

interface RawImport {
  source: string;
  items?: string[];
  alias?: string;
  isWildcard?: boolean;
  span?: {
    startLine: number;
    endLine: number;
  };
  bindings?: Array<{
    importedName: string;
    localName: string;
  }>;
}

interface RawStructure {
  kind: {
    type: string;
  };
  name: string;
  span: {
    startByte: number;
    endByte: number;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  children: unknown[];
  decorators: unknown[];
  signature: string;
  bodySpan: {
    startByte: number;
    endByte: number;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

function getNodeText(
  node: AstNode,
  source: string,
): string {
  return source.slice(
    node.startByte(),
    node.endByte(),
  );
}

function getChildTextByField(
  node: AstNode,
  fieldName: string,
  source: string,
): string | null {
  const child =
    node.childByFieldName(fieldName);

  if (!child) {
    return null;
  }

  return getNodeText(child, source);
}

function getStringValue(
  node: AstNode,
  source: string,
): string | null {
  const text = getNodeText(
    node,
    source,
  ).trim();

  if (text.length < 2) {
    return null;
  }

  const first = text[0];
  const last =
    text[text.length - 1];

  if (
    (first === "\"" &&
      last === "\"") ||
    (first === "'" &&
      last === "'") ||
    (first === "`" &&
      last === "`")
  ) {
    return text.slice(
      1,
      -1,
    );
  }

  return null;
}

function getLineSpan(
  node: AstNode,
) {
  return {
    startLine:
      node.startPosition().row + 1,
    endLine:
      node.endPosition().row + 1,
  };
}

function getStructureName(
  leftNode: AstNode,
  source: string,
): string | null {
  const kind =
    leftNode.kind();

  if (
    kind === "identifier"
  ) {
    return getNodeText(
      leftNode,
      source,
    );
  }

  if (
    kind === "member_expression"
  ) {
    const property =
      leftNode.childByFieldName(
        "property",
      );

    if (property) {
      return getNodeText(
        property,
        source,
      );
    }
  }

  return null;
}

function parseCommonJsBinding(
  leftNode: AstNode,
  source: string,
): {
  importedName: string;
  localName: string;
}[] {
  const bindings: {
    importedName: string;
    localName: string;
  }[] = [];

  const nameKind =
    leftNode.kind();

  if (
    nameKind === "identifier"
  ) {
    const localName =
      getNodeText(
        leftNode,
        source,
      );

    if (localName) {
      bindings.push({
        importedName: "default",
        localName,
      });
    }

    return bindings;
  }

  if (
    nameKind === "object_pattern"
  ) {
    for (
      let index = 0;
      index <
      leftNode.namedChildCount();
      index++
    ) {
      const child =
        leftNode.namedChild(
          index,
        );

      if (!child) {
        continue;
      }

      if (
        child.kind() ===
        "shorthand_property_identifier_pattern"
      ) {
        const name =
          getNodeText(
            child,
            source,
          );

        bindings.push({
          importedName: name,
          localName: name,
        });

        continue;
      }

      if (
        child.kind() ===
        "pair_pattern"
      ) {
        const key =
          child.childByFieldName(
            "key",
          );

        const value =
          child.childByFieldName(
            "value",
          );

        if (!key || !value) {
          continue;
        }

        bindings.push({
          importedName:
            getNodeText(
              key,
              source,
            ),
          localName:
            getNodeText(
              value,
              source,
            ),
        });
      }
    }
  }

  return bindings;
}

function extractJavaScriptImports(
  source: string,
  tree: AstTree,
): RawImport[] {
  const imports: RawImport[] = [];

  function walk(
    node: AstNode,
    ancestors: AstNode[],
  ): void {
    if (
      node.kind() ===
      "call_expression"
    ) {
      const functionNode =
        node.childByFieldName(
          "function",
        );

      if (
        functionNode &&
        functionNode.kind() ===
          "identifier" &&
        getNodeText(
          functionNode,
          source,
        ) === "require"
      ) {
        const argumentsNode =
          node.childByFieldName(
            "arguments",
          );

        const argument =
          argumentsNode?.namedChild(
            0,
          );

        const moduleSpecifier =
          argument
            ? getStringValue(
                argument,
                source,
              )
            : null;

        if (moduleSpecifier) {
          let bindingNode:
            AstNode | null =
            null;

          for (
            let i =
              ancestors.length - 1;
            i >= 0;
            i--
          ) {
            const ancestor =
              ancestors[i];

            if (
              ancestor?.kind() ===
              "variable_declarator"
            ) {
              bindingNode =
                ancestor.childByFieldName(
                  "name",
                );

              break;
            }
          }

          const bindings =
            bindingNode
              ? parseCommonJsBinding(
                  bindingNode,
                  source,
                )
              : [];

          const lineSpan =
            getLineSpan(node);

          imports.push({
            source:
              getNodeText(
                node,
                source,
              ),
            items:
              bindings.map(
                (binding) =>
                  binding.importedName,
              ),
            alias:
              bindings[0]
                ?.localName,
            isWildcard: false,
            span: lineSpan,
            bindings,
          });
        }
      }
    }

    for (
      let index = 0;
      index <
      node.namedChildCount();
      index++
    ) {
      const child =
        node.namedChild(
          index,
        );

      if (!child) {
        continue;
      }

      walk(
        child,
        [...ancestors, node],
      );
    }
  }

  walk(
    tree.rootNode(),
    [],
  );

  return imports;
}

function extractJavaScriptStructures(
  source: string,
  tree: AstTree,
): RawStructure[] {
  const structures:
    RawStructure[] = [];

  function createStructure(
    name: string,
    functionNode: AstNode,
  ): RawStructure {
    const span =
      getLineSpan(
        functionNode,
      );

    return {
      kind: {
        type: "Function",
      },
      name,
      span: {
        startByte:
          functionNode.startByte(),
        endByte:
          functionNode.endByte(),
        startLine:
          functionNode
            .startPosition()
            .row + 1,
        startColumn:
          functionNode
            .startPosition()
            .column,
        endLine:
          functionNode
            .endPosition()
            .row + 1,
        endColumn:
          functionNode
            .endPosition()
            .column,
      },
      children: [],
      decorators: [],
      signature:
        getNodeText(
          functionNode,
          source,
        )
          .split("{")[0]
          ?.trim() ?? "",
      bodySpan: {
        startByte:
          functionNode.startByte(),
        endByte:
          functionNode.endByte(),
        startLine:
          span.startLine,
        startColumn:
          functionNode
            .startPosition()
            .column,
        endLine:
          span.endLine,
        endColumn:
          functionNode
            .endPosition()
            .column,
      },
    };
  }

  function walk(
    node: AstNode,
    ancestors: AstNode[],
  ): void {
    if (
      node.kind() ===
      "assignment_expression"
    ) {
      const left =
        node.childByFieldName(
          "left",
        );

      const right =
        node.childByFieldName(
          "right",
        );

      if (
        left &&
        right &&
        (
          right.kind() ===
            "arrow_function" ||
          right.kind() ===
            "function"
        )
      ) {
        const name =
          getStructureName(
            left,
            source,
          );

        if (name) {
          structures.push(
            createStructure(
              name,
              right,
            ),
          );
        }
      }
    }

    if (
      node.kind() ===
        "variable_declarator"
    ) {
      const nameNode =
        node.childByFieldName(
          "name",
        );

      const valueNode =
        node.childByFieldName(
          "value",
        );

      if (
        nameNode &&
        valueNode &&
        (
          valueNode.kind() ===
            "arrow_function" ||
          valueNode.kind() ===
            "function"
        )
      ) {
        const name =
          getStructureName(
            nameNode,
            source,
          );

        if (name) {
          structures.push(
            createStructure(
              name,
              valueNode,
            ),
          );
        }
      }
    }

    for (
      let index = 0;
      index <
      node.namedChildCount();
      index++
    ) {
      const child =
        node.namedChild(
          index,
        );

      if (!child) {
        continue;
      }

      walk(
        child,
        [...ancestors, node],
      );
    }
  }

  walk(
    tree.rootNode(),
    [],
  );

  return structures;
}

function mergeStructures(
  existing: unknown[],
  additional: RawStructure[],
): unknown[] {
  const result = [
    ...existing,
  ];

  const existingKeys =
    new Set(
      existing
        .filter(
          (
            item,
          ): item is {
            name?: string;
            span?: {
              startLine?: number;
            };
          } =>
            typeof item ===
              "object" &&
            item !== null,
        )
        .map(
          (item) =>
            `${item.name ?? ""}|${
              item.span?.startLine ?? ""
            }`,
        ),
    );

  for (
    const item of additional
  ) {
    const key =
      `${item.name}|${item.span.startLine}`;

    if (
      existingKeys.has(
        key,
      )
    ) {
      continue;
    }

    result.push(item);
  }

  return result;
}

function mergeImports(
  existing: unknown[],
  additional: RawImport[],
): unknown[] {
  const result = [
    ...existing,
  ];

  const existingKeys =
    new Set(
      existing
        .filter(
          (
            item,
          ): item is {
            moduleSpecifier?: string;
            source?: string;
          } =>
            typeof item ===
              "object" &&
            item !== null,
        )
        .map(
          (item) =>
            item.moduleSpecifier ??
            item.source ??
            "",
        ),
    );

  for (
    const item of additional
  ) {
    if (
      existingKeys.has(
        item.source,
      )
    ) {
      continue;
    }

    result.push(item);
  }

  return result;
}

export function parseSource(
  source: string,
  language: string,
): ParsedFile {
  const result =
    process(source, {
      language,
      structure: true,
      imports: true,
      exports: true,
      symbols: true,
      diagnostics: true,
    });

  let structure: unknown[] =
    result.structure ?? [];

  let imports: unknown[] =
    result.imports ?? [];

  if (
    language ===
      "javascript" ||
    language ===
      "typescript" ||
    language ===
      "tsx"
  ) {
    const parser =
      getParser(language);

    const tree =
      parser.parse(source);

    if (tree) {
      const astTree =
        tree as unknown as AstTree;

      const additionalImports =
        extractJavaScriptImports(
          source,
          astTree,
        );

      const additionalStructures =
        extractJavaScriptStructures(
          source,
          astTree,
        );

      imports =
        mergeImports(
          imports,
          additionalImports,
        );

      structure =
        mergeStructures(
          structure,
          additionalStructures,
        );
    }
  }

  return {
    language:
      result.language ??
      language,

    structure,

    imports,

    exports:
      result.exports ?? [],

    symbols:
      result.symbols ?? [],

    diagnostics:
      result.diagnostics ?? [],

    metrics: {
      totalLines:
        result.metrics
          ?.totalLines ?? 0,
      codeLines:
        result.metrics
          ?.codeLines ?? 0,
      commentLines:
        result.metrics
          ?.commentLines ?? 0,
      blankLines:
        result.metrics
          ?.blankLines ?? 0,
      totalBytes:
        result.metrics
          ?.totalBytes ?? 0,
      nodeCount:
        result.metrics
          ?.nodeCount ?? 0,
      errorCount:
        result.metrics
          ?.errorCount ?? 0,
      maxDepth:
        result.metrics
          ?.maxDepth ?? 0,
    },
  };
}

export function parseSourceAst(
  source: string,
  language: string,
): ParsedAstFile {
  const parser =
    getParser(language);

  const tree =
    parser.parse(source);

  if (!tree) {
    throw new Error(
      `Tree-sitter returned no syntax tree for ${language}`,
    );
  }

  return {
    language,
    tree,
  };
}