import type {
  RepositoryIndex,
} from "../repository-context.service.js";

import type {
  CandidateNode,
  GraphNode,
  QuestionModel,
} from "./navigation.types.js";

interface SearchHit {
  filePath: string;
  content: string;
  rank: number;
  distance?: number;
  startLine?: number;
  endLine?: number;
}


const OPERATION_TERMS: Record<QuestionModel["operation"], string[]> = {
  flow: [
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
  ],
  usage: [
    "use",
    "usage",
    "used",
    "uses",
    "referenced",
    "references",
    "called",
  ],
  dependency: [
    "depend",
    "dependency",
    "dependencies",
    "import",
    "imports",
    "reference",
    "module",
    "modules",
  ],
  data: [
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
  ],
  configuration: [
    "config",
    "configuration",
    "setting",
    "settings",
    "environment",
    "env",
  ],
  location: [
    "where",
    "location",
    "path",
    "file",
    "located",
    "defined",
    "definition",
  ],
  behavior: [
    "behavior",
    "behaviour",
    "process",
    "handle",
    "work",
    "works",
    "behave",
    "purpose",
    "role",
  ],
  unknown: [],
};

const MAX_HITS_PER_FILE = 6;

export function findNavigationCandidates(
  repositoryIndex: RepositoryIndex,
  question: QuestionModel,
  searchResults: unknown,
): CandidateNode[] {
  const searchHits = normalizeSearchResults(
    searchResults,
  );

  const searchByFile =
    groupSearchHitsByFile(
      searchHits,
    );

  const candidates: CandidateNode[] = [];

  for (
    const file of repositoryIndex.files
  ) {
    const filePath = normalizePath(
      file.path,
    );

    const fileHits =
      searchByFile.get(filePath) ?? [];

    for (
      const symbol of file.symbols ?? []
    ) {
      const node: GraphNode = {
        id: buildSymbolId(
          repositoryIndex.repositoryIndex,
          filePath,
          symbol.kind,
          symbol.name,
          symbol.startLine,
        ),
        filePath,
        symbol: symbol.name,
        kind: symbol.kind,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
      };

      const scored = scoreNode(
        node,
        symbol.signature ?? "",
        filePath,
        question,
        fileHits,
      );

      if (scored.score <= 0) {
        continue;
      }

      candidates.push({
        node,
        score: scored.score,
        reasons: scored.reasons,
      });
    }

    const fileNode: GraphNode = {
      id: filePath,
      filePath,
      kind: "file",
      startLine: 1,
      endLine:
        file.symbols?.at(-1)?.endLine ?? 1,
    };

    const fileScore = scoreFile(
      filePath,
      question,
      fileHits,
    );

    if (fileScore.score <= 0) {
      continue;
    }

    candidates.push({
      node: fileNode,
      score: fileScore.score,
      reasons: fileScore.reasons,
    });
  }

  const result = deduplicateCandidates(
    candidates,
  )
    .sort(compareCandidates)
    .slice(0, 40);

  console.log(
    "[NAV:CANDIDATES]",
    JSON.stringify(
      {
        question,
        candidates: result.map(
          (candidate) => ({
            filePath:
              candidate.node.filePath,
            symbol:
              candidate.node.symbol ??
              null,
            kind:
              candidate.node.kind ??
              "file",
            score:
              candidate.score,
            reasons:
              candidate.reasons,
          }),
        ),
      },
      null,
      2,
    ),
  );

  return result;
}

function scoreNode(
  node: GraphNode,
  signature: string,
  filePath: string,
  question: QuestionModel,
  searchHits: SearchHit[],
): {
  score: number;
  reasons: string[];
} {
  const name = normalizeText(
    node.symbol ?? "",
  );

  const path = normalizeText(
    filePath,
  );

  const normalizedSignature =
    normalizeText(signature);

  const subjectTerms =
    getSubjectTerms(question);

  let score = 0;

  const reasons: string[] = [];

  for (
    const term of subjectTerms
  ) {
    const variants =
      expandTermVariants(term);

    for (
      const variant of variants
    ) {
      if (!variant) {
        continue;
      }

      if (name === variant) {
        score += 60;

        reasons.push(
          `exact symbol match "${variant}"`,
        );
      } else if (
        name.includes(variant)
      ) {
        score += 34;

        reasons.push(
          `symbol matches "${variant}"`,
        );
      }

      if (path.includes(variant)) {
        score += 10;

        reasons.push(
          `file path matches "${variant}"`,
        );
      }

      if (
        normalizedSignature.includes(
          variant,
        )
      ) {
        score += 8;
      }
    }
  }

  let bestRetrieval = 0;
  let bestOverlap = 0;
  let bestContentMatch = 0;

  for (
    const hit of searchHits
  ) {
    const searchContent =
      normalizeText(
        hit.content,
      );

    let contentMatch = 0;

    for (
      const term of subjectTerms
    ) {
      for (
        const variant of expandTermVariants(
          term,
        )
      ) {
        if (
          variant &&
          searchContent.includes(
            variant,
          )
        ) {
          contentMatch = Math.max(
            contentMatch,
            3,
          );
        }
      }
    }

    const overlap =
      getOverlapScore(
        node,
        hit,
      );

    const retrieval =
      retrievalScore(
        hit,
      );

    bestRetrieval = Math.max(
      bestRetrieval,
      retrieval,
    );

    bestOverlap = Math.max(
      bestOverlap,
      overlap,
    );

    bestContentMatch =
      Math.max(
        bestContentMatch,
        contentMatch,
      );
  }

  if (bestRetrieval > 0) {
    score += bestRetrieval;
    reasons.push(
      "retrieved by repository search",
    );
  }

  if (bestOverlap > 0) {
    score += bestOverlap;

    if (
      bestOverlap >= 45
    ) {
      reasons.push(
        "symbol overlaps retrieved code range",
      );
    } else {
      reasons.push(
        "symbol is near retrieved code range",
      );
    }
  }

  score += bestContentMatch;

  score +=
    operationKindScore(
      node,
      question.operation,
    );

  score += actionIntentScore(node, question);

  return {
    score,
    reasons,
  };
}

function actionIntentScore(
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
      if (symbol === variant || symbol.includes(variant)) score += 35;
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

function scoreFile(
  filePath: string,
  question: QuestionModel,
  searchHits: SearchHit[],
): {
  score: number;
  reasons: string[];
} {
  const path = normalizeText(
    filePath,
  );

  const subjectTerms =
    getSubjectTerms(question);

  let score = 0;

  const reasons: string[] = [];

  for (
    const term of subjectTerms
  ) {
    for (
      const variant of expandTermVariants(
        term,
      )
    ) {
      if (
        variant &&
        path.includes(variant)
      ) {
        score += 14;

        reasons.push(
          `file path matches "${variant}"`,
        );
      }
    }
  }

  let bestRetrieval = 0;

  for (
    const hit of searchHits
  ) {
    bestRetrieval = Math.max(
      bestRetrieval,
      retrievalScore(hit),
    );
  }

  if (bestRetrieval > 0) {
    score +=
      bestRetrieval * 0.7;

    reasons.push(
      "retrieved by repository search",
    );
  }

  score +=
    operationFileScore(
      question.operation,
    );

  return {
    score,
    reasons,
  };
}

function operationFileScore(
  operation: QuestionModel["operation"],
): number {
  switch (operation) {
    case "dependency":
      return 8;

    case "location":
      return 5;

    case "data":
      return 2;

    default:
      return 0;
  }
}

function getSubjectTerms(
  question: QuestionModel,
): string[] {
  const operationTerms =
    new Set(
      (
        OPERATION_TERMS[
          question.operation
        ] ?? []
      ).map(
        normalizeText,
      ),
    );

  const terms =
    question.terms
      .map(
        normalizeText,
      )
      .filter(Boolean)
      .filter(
        (term) =>
          !operationTerms.has(term),
      );

  if (terms.length > 0) {
    return uniqueStrings(
      terms,
    );
  }

  return uniqueStrings(
    question.terms
      .map(
        normalizeText,
      )
      .filter(Boolean),
  );
}

function retrievalScore(
  hit: SearchHit,
): number {
  const rankScore = Math.max(
    1,
    10 -
      hit.rank *
        0.75,
  );

  if (
    hit.distance === undefined ||
    !Number.isFinite(
      hit.distance,
    )
  ) {
    return rankScore;
  }

  const distanceScore =
    Math.max(
      0,
      7 -
        hit.distance *
          5,
    );

  return (
    rankScore +
    distanceScore
  );
}

function getOverlapScore(
  node: GraphNode,
  hit: SearchHit,
): number {
  if (
    hit.startLine === undefined ||
    hit.endLine === undefined
  ) {
    return 0;
  }

  if (
    node.startLine >=
      hit.startLine &&
    node.startLine <=
      hit.endLine
  ) {
    return 45;
  }

  if (
    node.startLine <=
      hit.endLine &&
    node.endLine >=
      hit.startLine
  ) {
    return 26;
  }

  const distance = lineDistance(
    node,
    hit,
  );

  if (distance === null) {
    return 0;
  }

  if (distance <= 8) {
    return 14;
  }

  if (distance <= 20) {
    return 6;
  }

  return 0;
}

function lineDistance(
  node: GraphNode,
  hit: SearchHit,
): number | null {
  if (
    hit.startLine === undefined ||
    hit.endLine === undefined
  ) {
    return null;
  }

  if (
    node.endLine <
    hit.startLine
  ) {
    return (
      hit.startLine -
      node.endLine
    );
  }

  if (
    node.startLine >
    hit.endLine
  ) {
    return (
      node.startLine -
      hit.endLine
    );
  }

  return 0;
}

function operationKindScore(
  node: GraphNode,
  operation: QuestionModel["operation"],
): number {
  switch (operation) {
    case "flow":
    case "behavior":
      return (
        node.kind === "function" ||
        node.kind === "method" ||
        node.kind === "route"
          ? 8
          : 0
      );

    case "usage":
      return (
        node.kind === "function" ||
        node.kind === "method" ||
        node.kind === "class"
          ? 7
          : 0
      );

    case "dependency":
      return node.kind ===
        "file"
        ? 8
        : 2;

    case "data":
      return (
        node.kind === "model" ||
        node.kind === "schema"
          ? 14
          : node.kind === "field"
            ? 12
            : 0
      );

    case "configuration":
      return (
        node.kind ===
          "constant" ||
        node.kind ===
          "variable"
          ? 7
          : 0
      );

    case "location":
      return 4;

    default:
      return 0;
  }
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

  const irregular: Record<
    string,
    string[]
  > = {
    validated: [
      "validate",
      "validation",
    ],
    validating: [
      "validate",
      "validation",
    ],
    validation: [
      "validate",
      "validated",
    ],
    processed: [
      "process",
      "processing",
    ],
    processing: [
      "process",
      "processed",
    ],
    created: [
      "create",
      "creating",
    ],
    creating: [
      "create",
      "created",
    ],
    updated: [
      "update",
      "updating",
    ],
    updating: [
      "update",
      "updated",
    ],
    deleted: [
      "delete",
      "deleting",
    ],
    deleting: [
      "delete",
      "deleted",
    ],
    fetched: [
      "fetch",
      "fetching",
    ],
    fetching: [
      "fetch",
      "fetched",
    ],
    parsed: [
      "parse",
      "parsing",
    ],
    parsing: [
      "parse",
      "parsed",
    ],
    saved: [
      "save",
      "saving",
    ],
    saving: [
      "save",
      "saved",
    ],
    loaded: [
      "load",
      "loading",
    ],
    loading: [
      "load",
      "loaded",
    ],
    predicted: [
      "predict",
      "prediction",
    ],
    predicting: [
      "predict",
      "prediction",
    ],
    prediction: [
      "predict",
      "predicted",
    ],
    trained: [
      "train",
      "training",
    ],
    training: [
      "train",
      "trained",
    ],
    generated: [
      "generate",
      "generating",
    ],
    generating: [
      "generate",
      "generated",
    ],
  };

  for (
    const value of
      irregular[normalized] ?? []
  ) {
    variants.add(value);
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

function normalizeSearchResults(
  results: unknown,
): SearchHit[] {
  if (!Array.isArray(results)) {
    return [];
  }

  const hits: SearchHit[] = [];

  for (
    let index = 0;
    index < results.length;
    index += 1
  ) {
    const result =
      results[index];

    if (
      typeof result !==
        "object" ||
      result === null
    ) {
      continue;
    }

    const value =
      result as Record<
        string,
        unknown
      >;

    const metadata =
      typeof value.metadata ===
          "object" &&
        value.metadata !== null
        ? (
            value.metadata as Record<
              string,
              unknown
            >
          )
        : undefined;

    const filePath =
      firstString([
        value.filePath,
        value.path,
        value.source,
        metadata?.filePath,
        metadata?.path,
        metadata?.source,
      ]);

    if (!filePath) {
      continue;
    }

    const content =
      firstString([
        value.content,
        value.document,
        value.text,
        metadata?.content,
        metadata?.document,
        metadata?.text,
      ]) ?? "";

    const distance =
      firstNumber([
        value.distance,
        metadata?.distance,
      ]);

    const startLine =
      firstNumber([
        value.startLine,
        metadata?.startLine,
      ]);

    const endLine =
      firstNumber([
        value.endLine,
        metadata?.endLine,
      ]);

    hits.push({
      filePath,
      content,
      rank: index,
      distance,
      startLine,
      endLine,
    });
  }

  return hits;
}

function groupSearchHitsByFile(
  hits: SearchHit[],
): Map<string, SearchHit[]> {
  const map =
    new Map<
      string,
      SearchHit[]
    >();

  for (
    const hit of hits
  ) {
    const filePath =
      normalizePath(
        hit.filePath,
      );

    const list =
      map.get(filePath) ?? [];

    list.push(hit);

    map.set(
      filePath,
      list,
    );
  }

  for (
    const [
      filePath,
      hitsForFile,
    ] of map
  ) {
    map.set(
      filePath,
      hitsForFile
        .sort(
          (a, b) =>
            a.rank - b.rank,
        )
        .slice(
          0,
          MAX_HITS_PER_FILE,
        ),
    );
  }

  return map;
}

function firstString(
  values: unknown[],
): string | undefined {
  for (
    const value of values
  ) {
    if (
      typeof value ===
      "string"
    ) {
      return value;
    }
  }

  return undefined;
}

function firstNumber(
  values: unknown[],
): number | undefined {
  for (
    const value of values
  ) {
    if (
      typeof value ===
      "number"
    ) {
      return value;
    }
  }

  return undefined;
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ];
}

function deduplicateCandidates(
  candidates: CandidateNode[],
): CandidateNode[] {
  const map =
    new Map<
      string,
      CandidateNode
    >();

  for (
    const candidate of
      candidates
  ) {
    const existing =
      map.get(
        candidate.node.id,
      );

    if (
      !existing ||
      candidate.score >
        existing.score
    ) {
      map.set(
        candidate.node.id,
        candidate,
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function compareCandidates(
  a: CandidateNode,
  b: CandidateNode,
): number {
  const scoreDifference =
    b.score - a.score;

  if (
    Math.abs(
      scoreDifference,
    ) > 0.001
  ) {
    return scoreDifference;
  }

  if (
    Boolean(a.node.symbol) !==
    Boolean(b.node.symbol)
  ) {
    return a.node.symbol
      ? -1
      : 1;
  }

  return (
    a.node.filePath.localeCompare(
      b.node.filePath,
    )
  );
}

function buildSymbolId(
  repositoryId: string,
  filePath: string,
  kind: string,
  name: string,
  startLine: number,
): string {
  return [
    repositoryId,
    filePath,
    kind,
    name,
    startLine,
  ].join(":");
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