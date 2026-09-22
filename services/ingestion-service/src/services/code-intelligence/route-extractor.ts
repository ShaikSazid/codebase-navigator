import type {
    CodeRelationship,
    CodeSymbol,
} from "./indexer.types.js";

interface AstPosition {
    row: number;
    column: number;
}

interface AstNode {
    kind(): string;
    namedChildCount(): number;
    namedChild(index: number): AstNode | null;
    childByFieldName(
        name: string,
    ): AstNode | null;
    startByte(): number;
    endByte(): number;
    startPosition(): AstPosition;
    endPosition(): AstPosition;
}

interface AstTree {
    rootNode(): AstNode;
}

export interface RouteExtractionInput {
    repositoryId: string;
    filePath: string;
    source: string;
    tree: unknown;
}

export interface RouteExtractionResult {
    symbols: CodeSymbol[];
    relationships: CodeRelationship[];
}

const ROUTE_METHODS =
    new Set([
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "options",
        "head",
        "all",
    ]);

function getNodeText(
    node: AstNode,
    source: string,
): string {
    return source.slice(
        node.startByte(),
        node.endByte(),
    );
}

function getStringValue(
    node: AstNode | null,
    source: string,
): string | null {
    if (
        !node ||
        node.kind() !== "string"
    ) {
        return null;
    }

    const text =
        getNodeText(
            node,
            source,
        );

    if (text.length < 2) {
        return null;
    }

    const quote =
        text[0];

    if (
        (quote !== "\"" &&
            quote !== "'") ||
        text[text.length - 1] !==
        quote
    ) {
        return null;
    }

    return text.slice(
        1,
        -1,
    );
}

function getChildren(
    node: AstNode,
): AstNode[] {
    const children: AstNode[] =
        [];

    for (
        let index = 0;
        index <
        node.namedChildCount();
        index += 1
    ) {
        const child =
            node.namedChild(
                index,
            );

        if (child) {
            children.push(
                child,
            );
        }
    }

    return children;
}

function getArguments(
    callNode: AstNode,
): AstNode[] {
    const argumentsNode =
        callNode.childByFieldName(
            "arguments",
        );

    if (!argumentsNode) {
        return [];
    }

    return getChildren(
        argumentsNode,
    );
}

function getMemberCall(
    node: AstNode,
    source: string,
): {
    object: AstNode;
    property: string;
} | null {
    if (
        node.kind() !==
        "call_expression"
    ) {
        return null;
    }

    const functionNode =
        node.childByFieldName(
            "function",
        );

    if (
        !functionNode ||
        functionNode.kind() !==
        "member_expression"
    ) {
        return null;
    }

    const object =
        functionNode.childByFieldName(
            "object",
        );

    const property =
        functionNode.childByFieldName(
            "property",
        );

    if (!object || !property) {
        return null;
    }

    return {
        object,
        property:
            getNodeText(
                property,
                source,
            ),
    };
}

function getReferenceName(
    node: AstNode | null,
    source: string,
): string | null {
    if (!node) {
        return null;
    }

    switch (node.kind()) {
        case "identifier":
            return getNodeText(
                node,
                source,
            );

        case "member_expression": {
            const object =
                node.childByFieldName(
                    "object",
                );

            const property =
                node.childByFieldName(
                    "property",
                );

            if (!object || !property) {
                return null;
            }

            const objectName =
                getReferenceName(
                    object,
                    source,
                );

            const propertyName =
                getNodeText(
                    property,
                    source,
                );

            if (!objectName) {
                return propertyName;
            }

            return `${objectName}.${propertyName}`;
        }

        case "call_expression": {
            const functionNode =
                node.childByFieldName(
                    "function",
                );

            const argumentsList =
                getArguments(node);

            if (
                functionNode &&
                functionNode.kind() ===
                "member_expression"
            ) {
                const functionReference =
                    getReferenceName(
                        functionNode,
                        source,
                    );

                if (
                    argumentsList.length >
                    0
                ) {
                    const nestedReference =
                        getReferenceName(
                            argumentsList[0],
                            source,
                        );

                    if (
                        nestedReference
                    ) {
                        return nestedReference;
                    }
                }

                return functionReference;
            }

            if (
                argumentsList.length >
                0
            ) {
                const nestedReference =
                    getReferenceName(
                        argumentsList[0],
                        source,
                    );

                if (
                    nestedReference
                ) {
                    return nestedReference;
                }
            }

            return getReferenceName(
                functionNode,
                source,
            );
        }

        case "parenthesized_expression":
            return getReferenceName(
                node.namedChild(0),
                source,
            );

        case "await_expression":
            return getReferenceName(
                node.namedChild(0),
                source,
            );

        default:
            return null;
    }
}

function looksLikeRouterObject(
    object: AstNode,
    source: string,
): boolean {
    const reference =
        getReferenceName(
            object,
            source,
        );

    if (!reference) {
        return false;
    }

    const parts =
        reference.split(".");

    const terminal =
        parts[
            parts.length - 1
        ]?.toLowerCase();

    if (!terminal) {
        return false;
    }

    return (
        terminal === "app" ||
        terminal === "router" ||
        terminal === "route" ||
        terminal === "server" ||
        terminal === "api" ||
        terminal.endsWith("router")
    );
}

function looksLikeRouterMountTarget(
    node: AstNode,
    source: string,
): boolean {
    const reference =
        getReferenceName(
            node,
            source,
        );

    if (!reference) {
        return false;
    }

    const normalized =
        reference
            .replace(/\?\./g, ".")
            .replace(/::/g, ".");

    const parts =
        normalized.split(".");

    const terminal =
        parts[
            parts.length - 1
        ]?.toLowerCase();

    if (!terminal) {
        return false;
    }

    return (
        terminal === "router" ||
        terminal.endsWith("router")
    );
}

function findChainedRoutePath(
    callNode: AstNode,
    source: string,
): string | null {
    let current:
        AstNode | null =
        callNode;

    for (
        let depth = 0;
        depth < 32 && current;
        depth += 1
    ) {
        const member =
            getMemberCall(
                current,
                source,
            );

        if (!member) {
            return null;
        }

        const method =
            member.property.toLowerCase();

        if (method === "route") {
            if (
                !looksLikeRouterObject(
                    member.object,
                    source,
                )
            ) {
                return null;
            }

            const argumentsList =
                getArguments(
                    current,
                );

            return getStringValue(
                argumentsList[0] ?? null,
                source,
            );
        }

        if (
            member.object.kind() !==
            "call_expression"
        ) {
            return null;
        }

        current =
            member.object;
    }

    return null;
}

function getRoutePathFromCall(
    callNode: AstNode,
    source: string,
): {
    path: string;
    handlerArgumentIndex: number;
} | null {
    const member =
        getMemberCall(
            callNode,
            source,
        );

    if (!member) {
        return null;
    }

    const method =
        member.property.toLowerCase();

    if (
        !ROUTE_METHODS.has(
            method,
        )
    ) {
        return null;
    }

    const argumentsList =
        getArguments(
            callNode,
        );

    if (
        looksLikeRouterObject(
            member.object,
            source,
        )
    ) {
        for (
            let index = 0;
            index <
            argumentsList.length;
            index += 1
        ) {
            const path =
                getStringValue(
                    argumentsList[index],
                    source,
                );

            if (path !== null) {
                return {
                    path,
                    handlerArgumentIndex:
                        index + 1,
                };
            }
        }
    }

    const chainedPath =
        findChainedRoutePath(
            callNode,
            source,
        );

    if (chainedPath !== null) {
        return {
            path: chainedPath,
            handlerArgumentIndex: 0,
        };
    }

    return null;
}

function routeRelationshipKey(
    relationship: CodeRelationship,
): string {
    return [
        relationship.source,
        relationship.target,
        relationship.kind,
        relationship.evidence?.mountPath ?? "",
    ].join("|");
}

export function extractJavaScriptRoutes(
    input: RouteExtractionInput,
): RouteExtractionResult {
    const symbols: CodeSymbol[] =
        [];

    const relationships:
        CodeRelationship[] =
        [];

    const seenRoutes =
        new Set<string>();

    const tree =
        input.tree as AstTree;

    function walk(
        node: AstNode,
    ): void {
        if (
            node.kind() ===
            "call_expression"
        ) {
            const member =
                getMemberCall(
                    node,
                    input.source,
                );

            if (member) {
                const method =
                    member.property.toLowerCase();

                if (
                    method === "use" &&
                    looksLikeRouterObject(
                        member.object,
                        input.source,
                    )
                ) {
                    const argumentsList =
                        getArguments(node);

                    let mountPath = "";
                    let startIndex = 0;

                    const firstArgument =
                        argumentsList[0] ?? null;

                    const firstString =
                        getStringValue(
                            firstArgument,
                            input.source,
                        );

                    if (firstString !== null) {
                        mountPath = firstString;
                        startIndex = 1;
                    }

                    const routerArgument =
                        argumentsList
                            .slice(startIndex)
                            .reverse()
                            .find(
                                (argument) =>
                                    looksLikeRouterMountTarget(
                                        argument,
                                        input.source,
                                    ),
                            );

                    const routerReference =
                        routerArgument
                            ? getReferenceName(
                                routerArgument,
                                input.source,
                            )
                            : null;

                    if (routerReference) {
                        const startLine =
                            node.startPosition().row + 1;

                        const endLine =
                            node.endPosition().row + 1;

                        relationships.push({
                            source:
                                input.filePath,
                            target:
                                routerReference,
                            kind: "mounts",
                            confidence: 0.9,
                            evidence: {
                                filePath:
                                    input.filePath,
                                startLine,
                                endLine,
                                mountPath,
                            },
                        });
                    }
                }

                const routeInfo =
                    getRoutePathFromCall(
                        node,
                        input.source,
                    );

                if (
                    routeInfo &&
                    ROUTE_METHODS.has(
                        method,
                    )
                ) {
                    const startLine =
                        node.startPosition().row +
                        1;

                    const endLine =
                        node.endPosition().row +
                        1;

                    const routeKey =
                        `${method}:${routeInfo.path}:${startLine}`;

                    if (
                        !seenRoutes.has(
                            routeKey,
                        )
                    ) {
                        seenRoutes.add(
                            routeKey,
                        );

                        const routeId =
                            `${input.repositoryId}:${input.filePath}:route:${method}:${routeInfo.path}:${startLine}`;

                        symbols.push({
                            id: routeId,
                            name:
                                `${method.toUpperCase()} ${routeInfo.path}`,
                            kind: "route",
                            filePath:
                                input.filePath,
                            startLine,
                            endLine,
                            signature:
                                `${method.toUpperCase()} ${routeInfo.path}`,
                            routePaths: [
                                routeInfo.path,
                            ],
                        });

                        relationships.push({
                            source:
                                input.filePath,
                            target: routeId,
                            kind: "defines",
                            confidence: 1,
                            evidence: {
                                filePath:
                                    input.filePath,
                                startLine,
                                endLine,
                            },
                        });

                        const argumentsList =
                            getArguments(
                                node,
                            );

                        const handlerArguments =
                            argumentsList.slice(
                                routeInfo.handlerArgumentIndex,
                            );

                        const references =
                            handlerArguments
                                .map(
                                    (argument) =>
                                        getReferenceName(
                                            argument,
                                            input.source,
                                        ),
                                )
                                .filter(
                                    (
                                        value,
                                    ): value is string =>
                                        Boolean(
                                            value,
                                        ),
                                );

                        if (
                            references.length >
                            0
                        ) {
                            const handler =
                                references[
                                references.length - 1
                                ];

                            relationships.push({
                                source: routeId,
                                target: handler,
                                kind: "routes_to",
                                confidence: 0.9,
                                evidence: {
                                    filePath:
                                        input.filePath,
                                    startLine,
                                    endLine,
                                },
                            });

                            for (
                                let index = 0;
                                index <
                                references.length - 1;
                                index += 1
                            ) {
                                relationships.push({
                                    source: routeId,
                                    target:
                                        references[index],
                                    kind: "handles",
                                    confidence: 0.85,
                                    evidence: {
                                        filePath:
                                            input.filePath,
                                        startLine,
                                        endLine,
                                    },
                                });
                            }
                        }
                    }
                }
            }
        }

        for (
            const child of getChildren(
                node,
            )
        ) {
            walk(child);
        }
    }

    walk(
        tree.rootNode(),
    );

    const uniqueRelationships =
        new Map<
            string,
            CodeRelationship
        >();

    for (
        const relationship of
        relationships
    ) {
        uniqueRelationships.set(
            routeRelationshipKey(
                relationship,
            ),
            relationship,
        );
    }

    return {
        symbols,
        relationships: [
            ...uniqueRelationships.values(),
        ],
    };
}