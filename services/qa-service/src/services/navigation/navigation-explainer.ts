import type {
  GraphEdge,
  NavigationBranch,
  NavigationPath,
  NavigationStep,
  QuestionModel,
} from "./navigation.types.js";

export function buildNavigationSteps(
  path: NavigationPath,
  question: QuestionModel,
): NavigationStep[] {
  if (
    path.nodes.length === 0
  ) {
    return [];
  }

  const steps:
    NavigationStep[] = [];

  const first =
    path.nodes[0];

  if (
    first
  ) {
    steps.push({
      order: 1,
      filePath:
        first.filePath,
      symbol:
        first.symbol,
      kind:
        first.kind,
      startLine:
        first.startLine,
      endLine:
        first.endLine,
      explanation:
        explainEntryPoint(
          first,
          question,
        ),
    });
  }

  for (
    let index = 0;
    index <
      path.edges.length;
    index += 1
  ) {
    const edge =
      path.edges[index];

    const target =
      edge.target;

    if (
      !edge ||
      !target
    ) {
      continue;
    }

    steps.push({
      order:
        steps.length + 1,
      filePath:
        target.filePath,
      symbol:
        target.symbol,
      kind:
        target.kind,
      startLine:
        target.startLine,
      endLine:
        target.endLine,
      relationshipFromPrevious:
        edge.relationship.kind,
      relationshipEvidence:
        buildRelationshipEvidence(
          edge,
        ),
      explanation:
        explainRelationship(
          edge,
          question,
        ),
    });
  }

  return deduplicateSteps(
    steps,
  );
}

export function buildNavigationBranches(
  branches: GraphEdge[],
  steps: NavigationStep[],
  question: QuestionModel,
): NavigationBranch[] {
  const result:
    NavigationBranch[] = [];

  for (
    const edge
    of branches
  ) {
    const fromOrder =
      findSourceOrder(
        edge,
        steps,
      );

    result.push({
      fromOrder,
      filePath:
        edge.target.filePath,
      symbol:
        edge.target.symbol,
      kind:
        edge.target.kind,
      startLine:
        edge.target.startLine,
      endLine:
        edge.target.endLine,
      relationship:
        edge.relationship.kind,
      explanation:
        explainBranch(
          edge,
          question,
        ),
    });
  }

  return result;
}

export function buildNavigationSummary(
  question: string,
  steps: NavigationStep[],
  branches: NavigationBranch[],
): string {
  if (
    steps.length === 0
  ) {
    return [
      `No verified navigation flow was found for "${question}".`,
      "",
      "The repository graph did not contain enough connected evidence to construct a reliable path.",
    ].join("\n");
  }

  const flow =
    steps
      .map(
        (step) => {
          const location =
            step.symbol
              ? `${step.filePath}:${step.startLine} — ${step.symbol}`
              : `${step.filePath}:${step.startLine}`;

          return `${step.order}. ${location}\n   ${step.explanation}`;
        },
      )
      .join("\n");

  const branchText =
    branches.length > 0
      ? [
          "",
          "Related branches:",
          ...branches.map(
            (branch) =>
              `→ ${branch.filePath}:${branch.startLine}${branch.symbol ? ` — ${branch.symbol}` : ""} (${branch.relationship})`,
          ),
        ].join("\n")
      : "";

  return [
    `Verified repository flow for: "${question}"`,
    "",
    flow,
    branchText,
    "",
    "The path is derived from indexed repository relationships and retrieved code evidence.",
  ].join("\n");
}

function explainEntryPoint(
  node: NavigationStep extends infer T
    ? T extends NavigationStep
      ? Pick<
          T,
          "filePath" |
          "symbol" |
          "kind" |
          "startLine"
        >
      : never
    : never,
  question: QuestionModel,
): string {
  if (
    node.symbol
  ) {
    return `This ${node.kind ?? "symbol"} is the starting point selected from the repository graph for "${question.raw}".`;
  }

  return `This file is the starting point selected from the repository graph for "${question.raw}".`;
}

function explainRelationship(
  edge: GraphEdge,
  question: QuestionModel,
): string {
  const source =
    formatNode(
      edge.source,
    );

  const target =
    formatNode(
      edge.target,
    );

  switch (
    edge.relationship.kind
  ) {
    case "routes_to":
      return `${source} routes execution to ${target}.`;

    case "mounts":
      return `${source} mounts or connects to ${target}.`;

    case "calls":
      return `${source} calls ${target}.`;

    case "queries":
      return `${source} reads data associated with ${target}.`;

    case "writes":
      return `${source} writes or persists data through ${target}.`;

    case "instantiates":
      return `${source} creates an instance of ${target}.`;

    case "uses_schema":
      return `${source} uses ${target} as a schema or data structure.`;

    case "references":
      return `${source} references ${target}.`;

    case "imports":
      return `${source} imports ${target}.`;

    default:
      return `${source} connects to ${target} through ${edge.relationship.kind}.`;
  }
}

function explainBranch(
  edge: GraphEdge,
  question: QuestionModel,
): string {
  return `${formatNode(edge.source)} also has a ${edge.relationship.kind} relationship to ${formatNode(edge.target)}, which is a related branch of the requested flow.`;
}

function buildRelationshipEvidence(
  edge: GraphEdge,
):
  | {
      filePath: string;
      startLine: number;
      endLine: number;
    }
  | undefined {
  const evidence =
    edge.relationship
      .evidence;

  if (
    !evidence ||
    typeof evidence.startLine !==
      "number" ||
    typeof evidence.endLine !==
      "number"
  ) {
    return undefined;
  }

  return {
    filePath:
      evidence.filePath,
    startLine:
      evidence.startLine,
    endLine:
      evidence.endLine,
  };
}

function findSourceOrder(
  edge: GraphEdge,
  steps: NavigationStep[],
): number {
  const index =
    steps.findIndex(
      (step) =>
        step.filePath ===
          edge.source.filePath &&
        (
          !edge.source.symbol ||
          step.symbol ===
            edge.source.symbol
        ),
    );

  return index >= 0
    ? index + 1
    : 1;
}

function formatNode(
  node: {
    filePath: string;
    symbol?: string;
    startLine: number;
  },
): string {
  return node.symbol
    ? `${node.filePath}:${node.startLine} (${node.symbol})`
    : `${node.filePath}:${node.startLine}`;
}

function deduplicateSteps(
  steps: NavigationStep[],
): NavigationStep[] {
  const seen =
    new Set<string>();

  const result:
    NavigationStep[] = [];

  for (
    const step
    of steps
  ) {
    const key = [
      step.filePath,
      step.symbol ?? "",
      step.startLine,
    ].join("|");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      ...step,
      order:
        result.length + 1,
    });
  }

  return result;
}