import type {
  RepositoryIndex,
  RepositoryRelationship,
} from "../repository-context.service.js";

import type {
  CandidateNode,
  GraphEdge,
  GraphNode,
  NavigationPath,
  QuestionModel,
} from "./navigation.types.js";

const RELATIONSHIP_SCORES: Record<string, number> = {
  routes_to: 18,
  mounts: 16,
  calls: 14,
  queries: 11,
  writes: 11,
  instantiates: 10,
  uses_schema: 8,
  references: 7,
  imports: 3,
};

const NAVIGATION_RELATIONSHIPS = new Set(
  Object.keys(RELATIONSHIP_SCORES),
);

const MAX_DEPTH = 10;
const MAX_TARGETS = 16;
const MAX_PATHS_PER_TARGET = 8;
const MAX_FORWARD_DEPTH = 4;
const MAX_FORWARD_PATHS = 4;

interface ReversePathState {
  node: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  score: number;
}

export function buildNavigationGraph(
  repositoryIndex: RepositoryIndex,
): GraphEdge[] {
  const nodeMap = buildNodeMap(repositoryIndex);

  const edges: GraphEdge[] = [];

  for (const relationship of repositoryIndex.relationships) {
    if (!NAVIGATION_RELATIONSHIPS.has(relationship.kind)) {
      continue;
    }

    const source = resolveRelationshipNode(
      relationship.source,
      nodeMap,
    );

    const target = resolveRelationshipNode(
      relationship.target,
      nodeMap,
    );

    if (!source || !target) {
      continue;
    }

    if (source.id === target.id) {
      continue;
    }

    edges.push({
      source,
      target,
      relationship,
    });
  }

  return deduplicateEdges(edges);
}

export function findNavigationPath(
  graph: GraphEdge[],
  candidates: CandidateNode[],
  question: QuestionModel,
): NavigationPath | null {
  if (graph.length === 0 || candidates.length === 0) {
    console.log("[NAV:DEBUG] Empty graph or candidates");
    console.log("[NAV:DEBUG] graph.length:", graph.length);
    console.log("[NAV:DEBUG] candidates.length:", candidates.length);
    return null;
  }

  console.log("\n========== NAVIGATION DEBUG START ==========");
  console.log("[NAV:DEBUG] Question:", question.raw);
  console.log("[NAV:DEBUG] Normalized:", question.normalized);
  console.log("[NAV:DEBUG] Operation:", question.operation);
  console.log("[NAV:DEBUG] Graph edges:", graph.length);
  console.log("[NAV:DEBUG] Initial candidates:", candidates.length);

  console.log(
    "[NAV:DEBUG] INITIAL CANDIDATES:",
    JSON.stringify(
      candidates.map((candidate) => ({
        filePath: candidate.node.filePath,
        symbol: candidate.node.symbol ?? null,
        kind: candidate.node.kind ?? "file",
        score: candidate.score,
        subjectScore: getDirectSubjectMatchScore(
          candidate,
          question,
        ),
        reasons: candidate.reasons,
      })),
      null,
      2,
    ),
  );

  const navigationCandidates =
    augmentCandidatesWithSubjectNodes(
      candidates,
      graph,
      question,
    );

  console.log(
    "[NAV:DEBUG] AFTER SUBJECT NODE AUGMENTATION:",
    JSON.stringify(
      navigationCandidates.map((candidate) => ({
        filePath: candidate.node.filePath,
        symbol: candidate.node.symbol ?? null,
        kind: candidate.node.kind ?? "file",
        score: candidate.score,
        subjectScore: getDirectSubjectMatchScore(
          candidate,
          question,
        ),
        targetAffinity: targetAffinityScore(
          candidate,
          question,
        ),
        reasons: candidate.reasons,
      })),
      null,
      2,
    ),
  );

  const candidateScores = new Map<string, number>();

  for (const candidate of navigationCandidates) {
    candidateScores.set(
      candidate.node.id,
      candidate.score,
    );
  }

  const incoming = buildIncomingIndex(graph);

  const targetCandidates =
    selectTargetCandidates(
      navigationCandidates,
      question,
    ).slice(
      0,
      MAX_TARGETS,
    );

  console.log(
    "\n[NAV:TARGETS] SELECTED TARGET CANDIDATES:",
  );

  console.log(
    JSON.stringify(
      targetCandidates.map((candidate) => ({
        filePath: candidate.node.filePath,
        symbol: candidate.node.symbol ?? null,
        kind: candidate.node.kind ?? "file",
        candidateScore: candidate.score,
        subjectScore: getDirectSubjectMatchScore(
          candidate,
          question,
        ),
        targetAffinity: targetAffinityScore(
          candidate,
          question,
        ),
        reasons: candidate.reasons,
      })),
      null,
      2,
    ),
  );

  console.log(
    "\n[NAV:TARGETS] PREDICT_RISK CHECK:",
    JSON.stringify(
      targetCandidates
        .filter(
          (candidate) =>
            candidate.node.symbol
              ?.toLowerCase()
              .includes("predict"),
        )
        .map((candidate) => ({
          filePath: candidate.node.filePath,
          symbol: candidate.node.symbol,
          candidateScore: candidate.score,
          subjectScore: getDirectSubjectMatchScore(
            candidate,
            question,
          ),
          targetAffinity: targetAffinityScore(
            candidate,
            question,
          ),
          reasons: candidate.reasons,
        })),
      null,
      2,
    ),
  );

  console.log(
    "\n[NAV:TARGETS] SUBJECT TERMS:",
    JSON.stringify(
      getQuestionSubjectTerms(question),
      null,
      2,
    ),
  );

  let best: NavigationPath | null = null;

  for (const target of targetCandidates) {
    console.log(
      "\n[NAV:PATH] Evaluating target:",
      JSON.stringify(
        {
          filePath: target.node.filePath,
          symbol: target.node.symbol ?? null,
          kind: target.node.kind ?? "file",
          candidateScore: target.score,
          subjectScore: getDirectSubjectMatchScore(
            target,
            question,
          ),
          targetAffinity: targetAffinityScore(
            target,
            question,
          ),
        },
        null,
        2,
      ),
    );

    const directFlowPaths =
      findDirectFlowPaths(
        target,
        graph,
        incoming,
        candidateScores,
        question,
      );

    const reversePaths =
      directFlowPaths.length > 0
        ? []
        : findPathsToTarget(
            target,
            incoming,
            candidateScores,
            question,
          ).slice(
            0,
            MAX_PATHS_PER_TARGET,
          );

    const paths =
      (directFlowPaths.length > 0
        ? directFlowPaths
        : expandFlowPaths(
            reversePaths,
            graph,
            candidateScores,
            question,
          )
      ).slice(
        0,
        MAX_PATHS_PER_TARGET,
      );

    console.log(
      "[NAV:PATH] Paths found for target:",
      paths.length,
    );

    console.log(
      "[NAV:PATH] Candidate paths:",
      JSON.stringify(
        paths.map((path) => ({
          score: path.score,
          nodes: path.nodes.map((node) => ({
            filePath: node.filePath,
            symbol: node.symbol ?? null,
            kind: node.kind ?? "file",
          })),
          edges: path.edges.map((edge) => ({
            source: edge.source.symbol ?? edge.source.filePath,
            relationship: edge.relationship.kind,
            target: edge.target.symbol ?? edge.target.filePath,
          })),
        })),
        null,
        2,
      ),
    );

    for (const path of paths) {
      if (
        !best ||
        comparePaths(path, best) < 0
      ) {
        console.log(
          "[NAV:PATH] NEW BEST PATH:",
          JSON.stringify(
            {
              score: path.score,
              nodes: path.nodes.map((node) => ({
                filePath: node.filePath,
                symbol: node.symbol ?? null,
                kind: node.kind ?? "file",
              })),
            },
            null,
            2,
          ),
        );

        best = path;
      }
    }
  }

  if (!best) {
    console.log(
      "[NAV:PATH] No navigation path found.",
    );

    console.log(
      "========== NAVIGATION DEBUG END ==========\n",
    );

    return null;
  }

  console.log(
    "\n[NAV:PATH] FINAL BEST PATH:",
    JSON.stringify(
      {
        score: best.score,
        nodes: best.nodes.map((node) => ({
          filePath: node.filePath,
          symbol: node.symbol ?? null,
          kind: node.kind ?? "file",
        })),
        edges: best.edges.map((edge) => ({
          source:
            edge.source.symbol ??
            edge.source.filePath,
          relationship: edge.relationship.kind,
          target:
            edge.target.symbol ??
            edge.target.filePath,
        })),
      },
      null,
      2,
    ),
  );

  console.log(
    "========== NAVIGATION DEBUG END ==========\n",
  );

  return best;
}

export function collectNavigationBranches(
  path: NavigationPath,
  graph: GraphEdge[],
  question: QuestionModel,
): GraphEdge[] {
  const mainEdgeKeys = new Set(
    path.edges.map(buildEdgeKey),
  );

  const pathNodeIds = new Set(
    path.nodes.map((node) => node.id),
  );

  const branches: Array<{
    edge: GraphEdge;
    score: number;
    fromOrder: number;
  }> = [];

  for (
    let index = 0;
    index < path.nodes.length;
    index += 1
  ) {
    const node = path.nodes[index];

    if (!node) {
      continue;
    }

    for (const edge of graph) {
      if (edge.source.id !== node.id) {
        continue;
      }

      if (mainEdgeKeys.has(buildEdgeKey(edge))) {
        continue;
      }

      if (pathNodeIds.has(edge.target.id)) {
        continue;
      }

      const score = scoreReverseEdge(
        edge,
        question,
      );

      if (score < 10) {
        continue;
      }

      branches.push({
        edge,
        score,
        fromOrder: index + 1,
      });
    }
  }

  return branches
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.fromOrder - b.fromOrder;
    })
    .slice(0, 6)
    .map((entry) => entry.edge);
}

function augmentCandidatesWithSubjectNodes(
  candidates: CandidateNode[],
  graph: GraphEdge[],
  question: QuestionModel,
): CandidateNode[] {
  const result =
    new Map<string, CandidateNode>();

  for (const candidate of candidates) {
    result.set(
      candidate.node.id,
      candidate,
    );
  }

  const graphNodes =
    new Map<string, GraphNode>();

  for (const edge of graph) {
    graphNodes.set(
      edge.source.id,
      edge.source,
    );

    graphNodes.set(
      edge.target.id,
      edge.target,
    );
  }

  for (const node of graphNodes.values()) {
    if (result.has(node.id)) {
      continue;
    }

    const subjectScore =
      getDirectSubjectMatchScoreForNode(
        node,
        question,
      );

    if (subjectScore < 30) {
      continue;
    }

    result.set(
      node.id,
      {
        node,
        score: subjectScore,
        reasons: [
          "direct subject match from repository graph",
        ],
      },
    );

    console.log(
      "[NAV:AUGMENT] Added graph node as candidate:",
      JSON.stringify(
        {
          filePath: node.filePath,
          symbol: node.symbol ?? null,
          kind: node.kind ?? "file",
          subjectScore,
        },
        null,
        2,
      ),
    );
  }

  return [
    ...result.values(),
  ];
}

function selectTargetCandidates(
  candidates: CandidateNode[],
  question: QuestionModel,
): CandidateNode[] {
  const symbolCandidates =
    candidates.filter(
      (candidate) => {
        if (
          question.operation ===
            "dependency" ||
          question.operation ===
            "location"
        ) {
          return true;
        }

        return Boolean(
          candidate.node.symbol,
        );
      },
    );

  const source =
    symbolCandidates.length > 0
      ? symbolCandidates
      : candidates;

  const ranked = source
    .map(
      (candidate) => ({
        candidate,
        targetScore:
          targetAffinityScore(
            candidate,
            question,
          ),
      }),
    )
    .sort(
      (a, b) =>
        b.targetScore -
        a.targetScore,
    );

  const strongSubjectMatches =
    ranked.filter(
      ({ candidate }) =>
        getDirectSubjectMatchScore(
          candidate,
          question,
        ) >= 30,
    );

  console.log(
    "[NAV:SELECT] Strong subject matches:",
    JSON.stringify(
      strongSubjectMatches.map(
        ({ candidate, targetScore }) => ({
          filePath:
            candidate.node.filePath,
          symbol:
            candidate.node.symbol ??
            null,
          kind:
            candidate.node.kind ??
            "file",
          targetScore,
          subjectScore:
            getDirectSubjectMatchScore(
              candidate,
              question,
            ),
          reasons:
            candidate.reasons,
        }),
      ),
      null,
      2,
    ),
  );

  if (
    strongSubjectMatches.length > 0
  ) {
    return strongSubjectMatches.map(
      ({ candidate }) =>
        candidate,
    );
  }

  return ranked.map(
    ({ candidate }) =>
      candidate,
  );
}

function getDirectSubjectMatchScore(
  candidate: CandidateNode,
  question: QuestionModel,
): number {
  return getDirectSubjectMatchScoreForNode(
    candidate.node,
    question,
  );
}

function getDirectSubjectMatchScoreForNode(
  node: GraphNode,
  question: QuestionModel,
): number {
  const subjectTerms =
    getQuestionSubjectTerms(
      question,
    );

  const symbol =
    normalizeText(
      node.symbol ?? "",
    );

  const filePath =
    normalizeText(
      node.filePath,
    );

  let score = 0;

  for (const term of subjectTerms) {
    const variants =
      expandTermVariants(term);

    for (const variant of variants) {
      if (!variant) {
        continue;
      }

      if (symbol === variant) {
        score += 60;
        continue;
      }

      if (symbol.includes(variant)) {
        score += 34;
      }

      if (filePath.includes(variant)) {
        score += 10;
      }
    }
  }

  return score;
}

function getQuestionSubjectTerms(
  question: QuestionModel,
): string[] {
  const operationWords =
    new Set([
      "flow",
      "process",
      "processed",
      "handle",
      "happen",
      "works",
      "work",
      "execute",
      "executed",
      "calls",
      "called",

      "use",
      "usage",
      "used",
      "uses",
      "referenced",
      "references",

      "depend",
      "dependency",
      "dependencies",
      "import",
      "imports",
      "module",
      "modules",
      "reference",

      "data",
      "model",
      "schema",
      "field",
      "database",
      "query",
      "queries",
      "save",
      "stores",
      "store",
      "persist",
      "writes",
      "write",

      "config",
      "configuration",
      "setting",
      "settings",
      "environment",
      "env",

      "where",
      "location",
      "path",
      "file",
      "located",
      "defined",
      "definition",

      "behavior",
      "behaviour",
      "behave",
      "purpose",
      "role",

      "how",
      "what",
      "why",
      "when",
      "does",
      "do",
      "did",
      "is",
      "are",
      "was",
      "were",
      "can",
      "could",
      "would",
      "should",
      "will",

      "this",
      "that",
      "these",
      "those",
      "the",
      "a",
      "an",
      "and",
      "or",
      "to",
      "of",
      "for",
      "in",
      "on",
      "at",
      "by",
      "from",
      "with",
      "through",
      "within",
      "into",
      "project",
    ]);

  const rawTerms =
    `${question.raw} ${question.normalized} ${question.terms.join(" ")}`
      .split(/\s+/)
      .map(normalizeText)
      .filter(Boolean);

  return [
    ...new Set(
      rawTerms.filter(
        (term) =>
          !operationWords.has(term) &&
          term.length > 1,
      ),
    ),
  ];
}

function targetAffinityScore(
  candidate: CandidateNode,
  question: QuestionModel,
): number {
  let score =
    candidate.score;

  score +=
    getDirectSubjectMatchScore(
      candidate,
      question,
    ) * 1.5;

  score += getActionIntentScore(candidate.node, question);

  if (
    (question.operation === "flow" || question.operation === "behavior") &&
    (candidate.node.kind === "model" || candidate.node.kind === "schema" || candidate.node.kind === "field")
  ) {
    score -= 55;
  }

  for (const reason of candidate.reasons) {
    if (
      reason.startsWith(
        "exact symbol match",
      )
    ) {
      score += 55;
      continue;
    }

    if (
      reason.startsWith(
        "symbol matches",
      )
    ) {
      score += 35;
      continue;
    }

    if (
      reason.startsWith(
        "file path matches",
      )
    ) {
      score += 16;
      continue;
    }

    if (
      reason ===
      "symbol overlaps retrieved code range"
    ) {
      score += 34;
      continue;
    }

    if (
      reason ===
      "symbol is near retrieved code range"
    ) {
      score += 10;
    }
  }

  if (
    question.operation ===
      "flow" ||
    question.operation ===
      "behavior"
  ) {
    if (
      candidate.node.kind ===
        "function" ||
      candidate.node.kind ===
        "method"
    ) {
      score += 8;
    }
  }

  if (
    question.operation ===
    "data"
  ) {
    if (
      candidate.node.kind ===
        "model" ||
      candidate.node.kind ===
        "schema" ||
      candidate.node.kind ===
        "field"
    ) {
      score += 16;
    }
  }

  if (
    candidate.node.kind ===
    "route"
  ) {
    score -= 16;
  }

  return score;
}

function getActionIntentScore(
  node: GraphNode,
  question: QuestionModel,
): number {
  const actions = getActionIntents(question);
  if (actions.length === 0) return 0;
  const symbol = normalizeText(node.symbol ?? "");
  let score = 0;
  for (const action of actions) {
    const variants = action === "create"
      ? ["create", "add", "save", "insert", "new"]
      : action === "update"
        ? ["update", "edit", "modify"]
        : action === "delete"
          ? ["delete", "destroy", "remove"]
          : ["get", "fetch", "find", "list", "show", "index"];
    for (const variant of variants) {
      if (symbol === variant) score += 100;
      else if (symbol.includes(variant)) score += 75;
    }
  }
  return score;
}

function getActionIntents(question: QuestionModel): string[] {
  const text = normalizeText(`${question.raw} ${question.normalized} ${question.terms.join(" ")}`);
  const actions: string[] = [];
  if (/\b(create|created|creating|add|added|adding|new|save|saved|saving|insert|inserted)\b/.test(text)) actions.push("create");
  if (/\b(update|updated|updating|edit|edited|editing|modify|modified)\b/.test(text)) actions.push("update");
  if (/\b(delete|deleted|deleting|remove|removed|removing|destroy|destroyed)\b/.test(text)) actions.push("delete");
  if (/\b(get|fetch|fetched|retrieve|retrieved|list|listed|show|shown|view|viewed)\b/.test(text)) actions.push("read");
  return [...new Set(actions)];
}

function findDirectFlowPaths(
  targetCandidate: CandidateNode,
  graph: GraphEdge[],
  incoming: Map<string, GraphEdge[]>,
  candidateScores: Map<string, number>,
  question: QuestionModel,
): NavigationPath[] {
  if (
    question.operation !== "flow" &&
    question.operation !== "behavior"
  ) {
    return [];
  }

  const target = targetCandidate.node;
  const subjectScore =
    getDirectSubjectMatchScoreForNode(
      target,
      question,
    );

  if (subjectScore < 30) {
    return [];
  }

  const starts: NavigationPath[] = [];

  if (
    target.kind === "model" ||
    target.kind === "schema" ||
    target.kind === "field"
  ) {
    const incomingOperations =
      getIncomingOperationEdgesForTarget(
        target,
        incoming,
      );

    for (const edge of incomingOperations) {
      const source = edge.source;
      const sourceCandidateScore =
        candidateScores.get(source.id) ?? 0;

      const sourceScore =
        getDirectSubjectMatchScoreForNode(
          source,
          question,
        );

      const routeEdge = findBestIncomingRouteEdge(
        source,
        incoming,
      );

      const start = routeEdge?.source ?? source;
      const startNodes = routeEdge
        ? [start, source]
        : [source];
      const startEdges = routeEdge
        ? [routeEdge]
        : [];

      const score =
        targetAffinityScore(
          targetCandidate,
          question,
        ) +
        sourceCandidateScore * 0.75 +
        sourceScore * 1.5 +
        scoreForwardEdge(edge, question) +
        (routeEdge
          ? scoreForwardEdge(routeEdge, question)
          : 0);

      starts.push({
        nodes: startNodes,
        edges: startEdges,
        score,
      });
    }
  } else {
    const routeEdge =
      findBestIncomingRouteEdge(
        target,
        incoming,
      );

    if (routeEdge) {
      starts.push({
        nodes: [routeEdge.source, target],
        edges: [routeEdge],
        score:
          targetAffinityScore(
            targetCandidate,
            question,
          ) +
          scoreForwardEdge(
            routeEdge,
            question,
          ),
      });
    } else {
      starts.push({
        nodes: [target],
        edges: [],
        score:
          targetAffinityScore(
            targetCandidate,
            question,
          ),
      });
    }
  }

  const expanded: NavigationPath[] = [];

  for (const start of starts) {
    expanded.push(
      ...expandSingleFlowPath(
        start,
        graph,
        candidateScores,
        question,
      ),
    );
  }

  const result = deduplicatePaths(expanded)
    .sort((a, b) => comparePaths(a, b));

  console.log(
    "[NAV:DIRECT-FLOW]",
    JSON.stringify(
      {
        target: {
          filePath: target.filePath,
          symbol: target.symbol ?? null,
          kind: target.kind ?? "file",
        },
        subjectScore,
        paths: result.map((path) => ({
          score: path.score,
          nodes: path.nodes.map((node) => ({
            filePath: node.filePath,
            symbol: node.symbol ?? null,
            kind: node.kind ?? "file",
          })),
          edges: path.edges.map((edge) => ({
            relationship: edge.relationship.kind,
            source: edge.source.symbol ?? edge.source.filePath,
            target: edge.target.symbol ?? edge.target.filePath,
          })),
        })),
      },
      null,
      2,
    ),
  );

  return result;
}

function getIncomingOperationEdgesForTarget(
  target: GraphNode,
  incoming: Map<string, GraphEdge[]>,
): GraphEdge[] {
  const directEdges = incoming.get(target.id) ?? [];
  const directOperationEdges = directEdges.filter((edge) =>
    isFlowOperationRelationship(edge.relationship.kind),
  );

  if (directOperationEdges.length > 0) return directOperationEdges;

  // Data-access edges can target the file node while the selected
  // candidate is a model/schema/field symbol in that same file.
  const sameFileEdges: GraphEdge[] = [];
  for (const edges of incoming.values()) {
    for (const edge of edges) {
      if (!isFlowOperationRelationship(edge.relationship.kind)) continue;
      if (edge.target.filePath !== target.filePath) continue;
      if (!sameFileEdges.some((existing) => buildEdgeKey(existing) === buildEdgeKey(edge))) {
        sameFileEdges.push(edge);
      }
    }
  }
  return sameFileEdges;
}

function isFlowOperationRelationship(
  relationship: string,
): boolean {
  return new Set([
    "routes_to",
    "mounts",
    "calls",
    "queries",
    "writes",
    "instantiates",
  ]).has(relationship);
}

function findBestIncomingRouteEdge(
  node: GraphNode,
  incoming: Map<string, GraphEdge[]>,
): GraphEdge | null {
  const candidates =
    (incoming.get(node.id) ?? []).filter(
      (edge) =>
        edge.relationship.kind === "routes_to" ||
        edge.relationship.kind === "mounts",
    );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort(
    (a, b) => {
      const score = (edge: GraphEdge): number =>
        edge.relationship.kind === "mounts"
          ? 16
          : edge.relationship.kind === "routes_to"
            ? 18
            : 0;

      return score(b) - score(a);
    },
  )[0] ?? null;
}

function findPathsToTarget(
  targetCandidate: CandidateNode,
  incoming: Map<string, GraphEdge[]>,
  candidateScores: Map<string, number>,
  question: QuestionModel,
): NavigationPath[] {
  const results: NavigationPath[] = [];

  const initial: ReversePathState = {
    node:
      targetCandidate.node,
    nodes: [
      targetCandidate.node,
    ],
    edges: [],
    score:
      targetAffinityScore(
        targetCandidate,
        question,
      ) *
      2.2,
  };

  const queue:
    ReversePathState[] = [
      initial,
    ];

  const visitedBest =
    new Map<
      string,
      number
    >();

  visitedBest.set(
    initial.node.id,
    initial.score,
  );

  while (
    queue.length > 0 &&
    results.length <
      MAX_PATHS_PER_TARGET
  ) {
    const state =
      queue.shift()!;

    const incomingEdges =
      incoming.get(
        state.node.id,
      ) ?? [];

    const entryScore =
      entryPointScore(
        state.node,
        incoming,
      );

    if (
      state.nodes.length > 1 ||
      entryScore > 0
    ) {
      const forwardNodes = [
        ...state.nodes,
      ].reverse();

      const forwardEdges = [
        ...state.edges,
      ].reverse();

      results.push({
        nodes:
          forwardNodes,
        edges:
          forwardEdges,
        score:
          state.score +
          entryScore,
      });
    }

    if (
      state.nodes.length >
      MAX_DEPTH
    ) {
      continue;
    }

    for (const edge of incomingEdges) {
      const source =
        edge.source;

      if (
        state.nodes.some(
          (node) =>
            node.id ===
            source.id,
        )
      ) {
        continue;
      }

      const sourceCandidateScore =
        candidateScores.get(
          source.id,
        ) ?? 0;

      const edgeScore =
        scoreReverseEdge(
          edge,
          question,
        );

      const depthPenalty =
        (state.nodes.length - 1) *
        3;

      const candidateBonus =
        sourceCandidateScore *
        0.5;

      const subjectBonus =
        getDirectSubjectMatchScoreForNode(
          source,
          question,
        ) *
        1.5;

      const nextScore =
        state.score +
        edgeScore +
        candidateBonus +
        subjectBonus -
        depthPenalty;

      console.log(
        "[NAV:STEP]",
        JSON.stringify(
          {
            source: {
              filePath:
                source.filePath,
              symbol:
                source.symbol ??
                null,
            },
            target: {
              filePath:
                edge.target.filePath,
              symbol:
                edge.target.symbol ??
                null,
            },
            relationship:
              edge.relationship.kind,
            edgeScore,
            candidateBonus,
            subjectBonus,
            depthPenalty,
            nextScore,
          },
          null,
          2,
        ),
      );

      const previous =
        visitedBest.get(
          source.id,
        );

      if (
        previous !== undefined &&
        previous >= nextScore
      ) {
        continue;
      }

      visitedBest.set(
        source.id,
        nextScore,
      );

      queue.push({
        node: source,
        nodes: [
          ...state.nodes,
          source,
        ],
        edges: [
          ...state.edges,
          edge,
        ],
        score:
          nextScore,
      });
    }

    queue.sort(
      (a, b) =>
        b.score -
        a.score,
    );
  }

  return deduplicatePaths(
    results,
  );
}

interface ForwardPathState {
  node: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  score: number;
  depth: number;
}

function expandFlowPaths(
  paths: NavigationPath[],
  graph: GraphEdge[],
  candidateScores: Map<string, number>,
  question: QuestionModel,
): NavigationPath[] {
  if (
    question.operation !== "flow" &&
    question.operation !== "behavior"
  ) {
    return paths;
  }

  const results: NavigationPath[] = [];

  for (const path of paths) {
    const expanded = expandSingleFlowPath(
      path,
      graph,
      candidateScores,
      question,
    );

    results.push(...expanded);
  }

  return deduplicatePaths(results);
}

function expandSingleFlowPath(
  path: NavigationPath,
  graph: GraphEdge[],
  candidateScores: Map<string, number>,
  question: QuestionModel,
): NavigationPath[] {
  const target = path.nodes.at(-1);

  if (!target) {
    return [path];
  }

  const outgoing = buildOutgoingIndex(graph);

  const initial: ForwardPathState = {
    node: target,
    nodes: [...path.nodes],
    edges: [...path.edges],
    score: path.score,
    depth: 0,
  };

  const queue: ForwardPathState[] = [initial];
  const results: NavigationPath[] = [];
  const visitedBest = new Map<string, number>();

  visitedBest.set(
    buildForwardStateKey(initial),
    initial.score,
  );

  while (
    queue.length > 0 &&
    results.length < MAX_FORWARD_PATHS
  ) {
    const state = queue.shift()!;

    const outgoingEdges =
      outgoing.get(state.node.id) ?? [];

    if (
      state.depth >= MAX_FORWARD_DEPTH ||
      outgoingEdges.length === 0
    ) {
      results.push({
        nodes: state.nodes,
        edges: state.edges,
        score: state.score,
      });
      continue;
    }

    let expanded = false;

    for (const edge of outgoingEdges) {
      const targetNode = edge.target;

      if (
        state.nodes.some(
          (node) => node.id === targetNode.id,
        )
      ) {
        continue;
      }

      if (
        !isAllowedForwardRelationship(
          edge.relationship.kind,
          question.operation,
        )
      ) {
        console.log(
          "[NAV:FORWARD] Skipping structural edge:",
          JSON.stringify({
            source: state.node.symbol ?? state.node.filePath,
            relationship: edge.relationship.kind,
            target: targetNode.symbol ?? targetNode.filePath,
          }),
        );
        continue;
      }

      const edgeScore =
        scoreForwardEdge(edge, question);

      if (edgeScore < 10) {
        continue;
      }

      const candidateBonus =
        (candidateScores.get(targetNode.id) ?? 0) * 0.5;

      const subjectBonus =
        getDirectSubjectMatchScoreForNode(
          targetNode,
          question,
        ) * 1.5;

      const depthPenalty = state.depth * 3;

      const nextScore =
        state.score +
        edgeScore +
        candidateBonus +
        subjectBonus -
        depthPenalty;

      console.log(
        "[NAV:FORWARD]",
        JSON.stringify(
          {
            source: {
              filePath: state.node.filePath,
              symbol: state.node.symbol ?? null,
            },
            target: {
              filePath: targetNode.filePath,
              symbol: targetNode.symbol ?? null,
            },
            relationship: edge.relationship.kind,
            edgeScore,
            candidateBonus,
            subjectBonus,
            depthPenalty,
            nextScore,
          },
          null,
          2,
        ),
      );

      const stateKey =
        `${targetNode.id}:${state.depth + 1}`;

      const previous = visitedBest.get(stateKey);

      if (
        previous !== undefined &&
        previous >= nextScore
      ) {
        continue;
      }

      visitedBest.set(stateKey, nextScore);

      queue.push({
        node: targetNode,
        nodes: [...state.nodes, targetNode],
        edges: [...state.edges, edge],
        score: nextScore,
        depth: state.depth + 1,
      });

      expanded = true;
    }

    if (!expanded) {
      results.push({
        nodes: state.nodes,
        edges: state.edges,
        score: state.score,
      });
    }

    queue.sort((a, b) => b.score - a.score);
  }

  return results;
}

function isAllowedForwardRelationship(
  relationship: string,
  operation: QuestionModel["operation"],
): boolean {
  if (
    operation === "flow" ||
    operation === "behavior"
  ) {
    return new Set([
      "routes_to",
      "mounts",
      "calls",
      "queries",
      "writes",
      "instantiates",
    ]).has(relationship);
  }

  return true;
}

function buildOutgoingIndex(
  graph: GraphEdge[],
): Map<string, GraphEdge[]> {
  const result = new Map<string, GraphEdge[]>();

  for (const edge of graph) {
    const list = result.get(edge.source.id) ?? [];
    list.push(edge);
    result.set(edge.source.id, list);
  }

  return result;
}

function scoreForwardEdge(
  edge: GraphEdge,
  question: QuestionModel,
): number {
  let score =
    RELATIONSHIP_SCORES[edge.relationship.kind] ?? 0;

  score += operationRelationshipScore(
    edge.relationship.kind,
    question.operation,
  );

  if (edge.source.filePath !== edge.target.filePath) {
    score += 2;
  }

  return score;
}

function buildForwardStateKey(
  state: ForwardPathState,
): string {
  return [state.node.id, state.depth].join(":");
}

function comparePaths(
  a: NavigationPath,
  b: NavigationPath,
): number {
  const scoreDifference =
    b.score -
    a.score;

  if (
    Math.abs(
      scoreDifference,
    ) > 0.001
  ) {
    return scoreDifference;
  }

  if (
    a.nodes.length !==
    b.nodes.length
  ) {
    return (
      a.nodes.length -
      b.nodes.length
    );
  }

  return (
    pathTargetSpecificity(
      b,
    ) -
    pathTargetSpecificity(
      a,
    )
  );
}

function pathTargetSpecificity(
  path: NavigationPath,
): number {
  const target =
    path.nodes.at(-1);

  if (!target) {
    return 0;
  }

  let score = 0;

  if (
    target.symbol
  ) {
    score += 20;
  }

  if (
    target.kind ===
      "model" ||
    target.kind ===
      "schema" ||
    target.kind ===
      "field"
  ) {
    score += 15;
  }

  return score;
}

function scoreReverseEdge(
  edge: GraphEdge,
  question: QuestionModel,
): number {
  let score =
    RELATIONSHIP_SCORES[
      edge.relationship.kind
    ] ?? 0;

  score +=
    operationRelationshipScore(
      edge.relationship.kind,
      question.operation,
    );

  if (
    edge.source.filePath !==
    edge.target.filePath
  ) {
    score += 2;
  }

  return score;
}

function operationRelationshipScore(
  relationship: string,
  operation: QuestionModel["operation"],
): number {
  switch (operation) {
    case "flow":
    case "behavior":
      return {
        routes_to: 9,
        mounts: 8,
        calls: 10,
        queries: 4,
        writes: 4,
        instantiates: 3,
        uses_schema: 2,
        references: 1,
        imports: -2,
      }[relationship] ?? 0;

    case "usage":
      return {
        routes_to: 2,
        mounts: 2,
        calls: 9,
        queries: 3,
        writes: 3,
        instantiates: 4,
        uses_schema: 3,
        references: 7,
        imports: 2,
      }[relationship] ?? 0;

    case "dependency":
      return {
        routes_to: 1,
        mounts: 1,
        calls: 3,
        queries: 1,
        writes: 1,
        instantiates: 3,
        uses_schema: 2,
        references: 5,
        imports: 9,
      }[relationship] ?? 0;

    case "data":
      return {
        routes_to: 1,
        mounts: 1,
        calls: 4,
        queries: 8,
        writes: 8,
        instantiates: 7,
        uses_schema: 9,
        references: 2,
        imports: 1,
      }[relationship] ?? 0;

    case "configuration":
    case "location":
      return {
        routes_to: 1,
        mounts: 1,
        calls: 2,
        queries: 1,
        writes: 1,
        instantiates: 2,
        uses_schema: 2,
        references: 6,
        imports: 7,
      }[relationship] ?? 0;

    default:
      return {
        routes_to: 3,
        mounts: 2,
        calls: 7,
        queries: 4,
        writes: 4,
        instantiates: 4,
        uses_schema: 3,
        references: 4,
        imports: 1,
      }[relationship] ?? 0;
  }
}

function entryPointScore(
  node: GraphNode,
  incoming: Map<string, GraphEdge[]>,
): number {
  let score = 0;

  if (
    node.kind ===
    "route"
  ) {
    score += 45;
  }

  if (
    node.kind ===
      "function" ||
    node.kind ===
      "method"
  ) {
    score += 20;
  }

  const incomingEdges =
    incoming.get(
      node.id,
    ) ?? [];

  if (
    incomingEdges.some(
      (edge) =>
        edge.relationship.kind ===
          "routes_to" ||
        edge.relationship.kind ===
          "mounts",
    )
  ) {
    score += 30;
  }

  const meaningfulIncoming =
    incomingEdges.filter(
      (edge) =>
        edge.relationship.kind ===
          "calls" ||
        edge.relationship.kind ===
          "routes_to" ||
        edge.relationship.kind ===
          "mounts",
    );

  if (
    meaningfulIncoming.length ===
    0
  ) {
    score += 14;
  }

  return score;
}

function buildNodeMap(
  repositoryIndex: RepositoryIndex,
): Map<string, GraphNode> {
  const map =
    new Map<
      string,
      GraphNode
    >();

  for (const file of repositoryIndex.files) {
    const filePath =
      normalizePath(
        file.path,
      );

    map.set(
      filePath,
      {
        id: filePath,
        filePath,
        kind: "file",
        startLine: 1,
        endLine:
          file.symbols
            ?.at(-1)
            ?.endLine ?? 1,
      },
    );

    for (const symbol of file.symbols ?? []) {
      const id = [
        repositoryIndex.repositoryIndex,
        filePath,
        symbol.kind,
        symbol.name,
        symbol.startLine,
      ].join(":");

      map.set(
        id,
        {
          id,
          filePath,
          symbol:
            symbol.name,
          kind:
            symbol.kind,
          startLine:
            symbol.startLine,
          endLine:
            symbol.endLine,
        },
      );
    }
  }

  return map;
}

function resolveRelationshipNode(
  id: string,
  nodeMap: Map<string, GraphNode>,
): GraphNode | null {
  const direct =
    nodeMap.get(id);

  if (direct) {
    return direct;
  }

  const normalized =
    normalizePath(id);

  const normalizedDirect =
    nodeMap.get(
      normalized,
    );

  if (
    normalizedDirect
  ) {
    return normalizedDirect;
  }

  for (const node of nodeMap.values()) {
    const filePath =
      normalizePath(
        node.filePath,
      );

    if (
      id.endsWith(
        `:${filePath}`,
      )
    ) {
      return node;
    }

    if (
      id.includes(
        `:${filePath}:`,
      )
    ) {
      if (
        node.symbol &&
        id.includes(
          `:${node.kind}:${node.symbol}:`,
        )
      ) {
        return node;
      }

      if (
        !node.symbol
      ) {
        return node;
      }
    }
  }

  for (const node of nodeMap.values()) {
    if (
      node.symbol &&
      id.includes(
        `:${node.kind}:${node.symbol}:`,
      )
    ) {
      return node;
    }
  }

  return null;
}

function buildIncomingIndex(
  graph: GraphEdge[],
): Map<
  string,
  GraphEdge[]
> {
  const result =
    new Map<
      string,
      GraphEdge[]
    >();

  for (const edge of graph) {
    const list =
      result.get(
        edge.target.id,
      ) ?? [];

    list.push(edge);

    result.set(
      edge.target.id,
      list,
    );
  }

  return result;
}

function deduplicateEdges(
  edges: GraphEdge[],
): GraphEdge[] {
  const seen =
    new Set<string>();

  const result:
    GraphEdge[] = [];

  for (const edge of edges) {
    const key =
      buildEdgeKey(
        edge,
      );

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(edge);
  }

  return result;
}

function deduplicatePaths(
  paths: NavigationPath[],
): NavigationPath[] {
  const map =
    new Map<
      string,
      NavigationPath
    >();

  for (const path of paths) {
    const key =
      path.nodes
        .map(
          (node) =>
            node.id,
        )
        .join(
          "->",
        );

    const existing =
      map.get(key);

    if (
      !existing ||
      path.score >
        existing.score
    ) {
      map.set(
        key,
        path,
      );
    }
  }

  return [
    ...map.values(),
  ].sort(
    (a, b) =>
      b.score -
      a.score,
  );
}

function buildEdgeKey(
  edge: GraphEdge,
): string {
  return [
    edge.source.id,
    edge.target.id,
    edge.relationship.kind,
  ].join("|");
}

function expandTermVariants(
  value: string,
): string[] {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return [];
  }

  const variants =
    new Set<string>([
      normalized,
    ]);

  const irregular:
    Record<string, string[]> = {
      prediction: [
        "predict",
        "predicted",
        "predicting",
      ],
      predicted: [
        "predict",
        "prediction",
        "predicting",
      ],
      predicting: [
        "predict",
        "prediction",
        "predicted",
      ],
      predictions: [
        "predict",
        "prediction",
      ],
      training: [
        "train",
        "trained",
      ],
      trained: [
        "train",
        "training",
      ],
      authentication: [
        "authenticate",
        "auth",
      ],
      authorization: [
        "authorize",
        "auth",
      ],
    };

  for (
    const variant of
      irregular[normalized] ??
      []
  ) {
    variants.add(variant);
  }

  if (
    normalized.endsWith("ing") &&
    normalized.length > 5
  ) {
    variants.add(
      normalized.slice(
        0,
        -3,
      ),
    );
  }

  if (
    normalized.endsWith("ed") &&
    normalized.length > 4
  ) {
    variants.add(
      normalized.slice(
        0,
        -2,
      ),
    );
  }

  if (
    normalized.endsWith("s") &&
    normalized.length > 3
  ) {
    variants.add(
      normalized.slice(
        0,
        -1,
      ),
    );
  }

  return [
    ...variants,
  ];
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(
      /([a-z0-9])([A-Z])/g,
      "$1 $2",
    )
    .replace(
      /[_./:-]+/g,
      " ",
    )
    .replace(
      /[^a-zA-Z0-9\s]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .toLowerCase();
}

function normalizePath(
  value: string,
): string {
  return value
    .replaceAll(
      "\\",
      "/",
    )
    .replace(
      /^\.\/+/,
      "",
    );
}