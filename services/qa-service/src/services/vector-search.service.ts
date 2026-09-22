import { QdrantClient } from "@qdrant/js-client-rest";

import { config } from "../config.js";

import {
  generateQueryEmbedding,
} from "./embedding.service.js";

const client =
  new QdrantClient({
    url: config.qdrantUrl,
    apiKey: config.qdrantApiKey,
  });

const COLLECTION_NAME =
  "codebase_chunks_384";

const CODE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".cs",
  ".rb",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
];

const DOCUMENT_FILES = [
  "readme.md",
  "project_report.md",
  "changelog.md",
  "contributing.md",
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "what",
  "where",
  "which",
  "who",
  "why",
]);

const SYNONYMS: Record<
  string,
  string[]
> = {
  analyzed: [
    "analyze",
    "analysis",
  ],

  analyzing: [
    "analyze",
    "analysis",
  ],

  analysis: [
    "analyze",
  ],

  analyze: [
    "analysis",
  ],

  pr: [
    "pull",
    "request",
  ],

  prs: [
    "pull",
    "request",
  ],

  github: [
    "git",
    "pull",
    "request",
  ],
};

export interface CodeSearchResult {
  chunkId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  distance: number;
}

interface RankedResult
  extends CodeSearchResult {
  score: number;
}

export async function searchCode(
  query: string,
  repositoryId: string,
  limit = 5,
): Promise<CodeSearchResult[]> {
  const queryEmbedding =
    await generateQueryEmbedding(
      query,
    );

  const semanticResult =
    await client.query(
      COLLECTION_NAME,
      {
        query:
          queryEmbedding,

        limit:
          Math.max(
            40,
            limit * 8,
          ),

        filter: {
          must: [
            {
              key:
                "repositoryId",

              match: {
                value:
                  repositoryId,
              },
            },
          ],
        },

        with_payload: true,

        with_vector: false,
      },
    );

  const semanticResults =
    semanticResult.points.map(
      (point) => {
        const payload =
          point.payload ?? {};

        const similarity =
          Number(
            point.score ?? 0,
          );

        return {
          chunkId:
            String(point.id),

          filePath:
            String(
              payload.filePath ??
                "",
            ),

          content:
            String(
              payload.content ??
                "",
            ),

          startLine:
            Number(
              payload.startLine ??
                0,
            ),

          endLine:
            Number(
              payload.endLine ??
                0,
            ),

          distance:
            1 - similarity,
        };
      },
    );

  const lexicalResult =
    await client.scroll(
      COLLECTION_NAME,
      {
        filter: {
          must: [
            {
              key:
                "repositoryId",

              match: {
                value:
                  repositoryId,
              },
            },
          ],
        },

        limit: 1000,

        with_payload: true,

        with_vector: false,
      },
    );

  const lexicalResults =
    lexicalResult.points.map(
      (point) => {
        const payload =
          point.payload ?? {};

        const chunkId =
          String(point.id);

        const existingSemantic =
          semanticResults.find(
            (result) =>
              result.chunkId ===
              chunkId,
          );

        return {
          chunkId,

          filePath:
            String(
              payload.filePath ??
                existingSemantic?.filePath ??
                "",
            ),

          content:
            String(
              payload.content ??
                existingSemantic?.content ??
                "",
            ),

          startLine:
            Number(
              payload.startLine ??
                existingSemantic?.startLine ??
                0,
            ),

          endLine:
            Number(
              payload.endLine ??
                existingSemantic?.endLine ??
                0,
            ),
          distance:
            existingSemantic?.distance ??
            2,
        };
      },
    );

  const combined =
    new Map<
      string,
      CodeSearchResult
    >();

  for (
    const result of semanticResults
  ) {
    combined.set(
      result.chunkId,
      result,
    );
  }

  for (
    const result of lexicalResults
  ) {
    combined.set(
      result.chunkId,
      result,
    );
  }

  const candidates:
    RankedResult[] =
    [...combined.values()].map(
      (result) => ({
        ...result,

        score:
          calculateScore(
            query,
            result,
          ),
      }),
    );

  candidates.sort(
    (a, b) =>
      b.score -
      a.score,
  );


  const selected =
    candidates
      .slice(0, limit)
      .map(
        ({
          score,
          ...result
        }) => result,
      );

  console.log(
    "QA retrieval:",
  );

  for (
    const result of selected
  ) {
    console.log(
      `${result.filePath}:${result.startLine}-${result.endLine} distance=${result.distance}`,
    );
  }

  return selected;
}

function calculateScore(
  query: string,
  result: CodeSearchResult,
): number {
  const semanticScore =
    1 /
    (1 +
      Math.max(
        result.distance,
        0,
      ));

  const queryTokens =
    expandQueryTokens(
      query,
    );

  const pathText =
    result.filePath.toLowerCase();

  const contentText =
    result.content.toLowerCase();

  const pathTokens =
    tokenize(
      result.filePath,
    );

  const contentTokens =
    tokenize(
      result.content,
    );

  let exactPathMatches = 0;

  let pathMatches = 0;

  let contentMatches = 0;

  for (
    const token of queryTokens
  ) {
    if (
      pathText.includes(token)
    ) {
      exactPathMatches++;
    }

    if (
      pathTokens.has(token)
    ) {
      pathMatches++;
    }

    if (
      contentText.includes(token)
    ) {
      contentMatches++;
    }
  }

  const tokenCount =
    Math.max(
      queryTokens.size,
      1,
    );

  const exactPathScore =
    exactPathMatches /
    tokenCount;

  const pathScore =
    pathMatches /
    tokenCount;

  const contentScore =
    contentMatches /
    tokenCount;

  const codeFile =
    isCodeFile(
      result.filePath,
    );

  const documentationFile =
    isDocumentationFile(
      result.filePath,
    );

  const documentationQuery =
    /\b(readme|documentation|docs|report|changelog)\b/i.test(
      query,
    );

  const codeQuestion =
    /\b(where|which|what|how|function|file|code|class|method|endpoint|route|controller|service|model|database|api|analyze|analysis|pull|request|pr)\b/i.test(
      query,
    );

  let sourcePreference = 0;

  if (
    !documentationQuery
  ) {
    if (codeFile) {
      sourcePreference +=
        0.25;
    }

    if (
      documentationFile
    ) {
      sourcePreference -=
        0.25;
    }
  }

  if (
    codeQuestion &&
    codeFile
  ) {
    sourcePreference +=
      0.15;
  }

  let analysisBoost = 0;

  if (
    /\banalyze_pr\b/i.test(
      result.content,
    )
  ) {
    analysisBoost +=
      0.8;
  }

  if (
    /\banalyze\/pr\b/i.test(
      result.content,
    )
  ) {
    analysisBoost +=
      0.8;
  }

  if (
    /Analyze PR request received/i.test(
      result.content,
    )
  ) {
    analysisBoost +=
      0.6;
  }

  if (
    /\bfetch_pr\b/i.test(
      result.content,
    )
  ) {
    analysisBoost +=
      0.25;
  }

  if (
    /\bpredict_risk\b/i.test(
      result.content,
    )
  ) {
    analysisBoost +=
      0.25;
  }

  if (
    /\bgithub\b/i.test(
      result.content,
    )
  ) {
    analysisBoost +=
      0.1;
  }

  return (
    semanticScore * 1.5 +
    exactPathScore * 1.2 +
    pathScore * 0.8 +
    contentScore * 0.5 +
    sourcePreference +
    analysisBoost
  );
}

function expandQueryTokens(
  text: string,
): Set<string> {
  const tokens =
    tokenize(text);

  const expanded =
    new Set<string>(
      tokens,
    );

  for (
    const token of tokens
  ) {
    const synonyms =
      SYNONYMS[token] ??
      [];

    for (
      const synonym of synonyms
    ) {
      const normalized =
        normalizeToken(
          synonym,
        );

      if (
        normalized &&
        !STOP_WORDS.has(
          normalized,
        )
      ) {
        expanded.add(
          normalized,
        );
      }
    }
  }

  return expanded;
}

function tokenize(
  text: string,
): Set<string> {
  const tokens =
    text
      .toLowerCase()
      .split(
        /[^a-z0-9_]+/,
      )
      .map(
        (token) =>
          normalizeToken(
            token.trim(),
          ),
      )
      .filter(
        (token) =>
          token.length > 1 &&
          !STOP_WORDS.has(
            token,
          ),
      );

  return new Set(tokens);
}

function normalizeToken(
  token: string,
): string {
  if (!token) {
    return "";
  }

  const irregular:
    Record<
      string,
      string
    > = {
      analyzed: "analyze",
      analysis: "analyze",
      analyzing: "analyze",
      analyses: "analyze",
      requests: "request",
      prs: "pr",
    };

  if (
    irregular[token]
  ) {
    return irregular[token];
  }

  if (
    token.endsWith("ies") &&
    token.length > 4
  ) {
    return (
      token.slice(
        0,
        -3,
      ) + "y"
    );
  }

  if (
    token.endsWith("es") &&
    token.length > 4
  ) {
    return token.slice(
      0,
      -2,
    );
  }

  if (
    token.endsWith("s") &&
    token.length > 3
  ) {
    return token.slice(
      0,
      -1,
    );
  }

  return token;
}

function isCodeFile(
  filePath: string,
): boolean {
  const normalized =
    filePath.toLowerCase();

  return CODE_EXTENSIONS.some(
    (extension) =>
      normalized.endsWith(
        extension,
      ),
  );
}

function isDocumentationFile(
  filePath: string,
): boolean {
  const normalized =
    filePath.toLowerCase();

  const fileName =
    normalized.split(
      "/",
    ).pop() ??
    normalized;

  if (
    DOCUMENT_FILES.includes(
      fileName,
    )
  ) {
    return true;
  }

  return (
    normalized.endsWith(
      ".md",
    ) ||
    normalized.endsWith(
      ".txt",
    )
  );
}