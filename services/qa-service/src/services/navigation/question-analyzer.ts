import type {
  NavigationOperation,
  QuestionModel,
} from "./navigation.types.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "could",
  "does",
  "do",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "should",
  "the",
  "this",
  "that",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "will",
  "with",
]);

export function analyzeQuestion(
  question: string,
): QuestionModel {
  const normalized =
    normalizeText(question);

  const rawTokens =
    normalized.split(" ");

  const terms = [
    ...new Set(
      rawTokens
        .filter(
          (token) =>
            token.length > 1 &&
            !STOP_WORDS.has(token),
        )
        .flatMap(expandToken),
    ),
  ];

  const phrases =
    buildPhrases(
      terms,
    );

  return {
    raw: question,
    normalized,
    terms,
    phrases,
    operation:
      detectOperation(
        normalized,
      ),
  };
}

function detectOperation(
  question: string,
): NavigationOperation {
  if (
    containsAny(
      question,
      [
        "used by",
        "use",
        "uses",
        "usage",
        "referenced",
        "references",
        "called by",
      ],
    )
  ) {
    return "usage";
  }

  if (
    containsAny(
      question,
      [
        "depend",
        "dependency",
        "dependencies",
        "import",
        "imports",
        "module",
        "modules",
      ],
    )
  ) {
    return "dependency";
  }

  if (
    containsAny(
      question,
      [
        "database",
        "data",
        "model",
        "schema",
        "query",
        "queries",
        "save",
        "stores",
        "store",
        "persist",
        "writes",
        "write",
      ],
    )
  ) {
    return "data";
  }

  if (
    containsAny(
      question,
      [
        "config",
        "configuration",
        "environment",
        "env",
        "setting",
        "settings",
      ],
    )
  ) {
    return "configuration";
  }

  if (
    containsAny(
      question,
      [
        "where",
        "located",
        "location",
        "defined",
        "definition",
      ],
    )
  ) {
    return "location";
  }

  if (
    containsAny(
      question,
      [
        "how",
        "flow",
        "happen",
        "works",
        "work",
        "execute",
        "executed",
        "process",
        "processed",
        "calls",
        "called",
      ],
    )
  ) {
    return "flow";
  }

  if (
    containsAny(
      question,
      [
        "why",
        "behavior",
        "behave",
        "purpose",
        "role",
      ],
    )
  ) {
    return "behavior";
  }

  return "unknown";
}

function containsAny(
  value: string,
  terms: string[],
): boolean {
  return terms.some(
    (term) =>
      value.includes(term),
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

function expandToken(
  token: string,
): string[] {
  const variants = new Set([
    token,
  ]);

  const stem =
    simpleStem(token);

  if (
    stem &&
    stem !== token &&
    stem.length > 1
  ) {
    variants.add(stem);
  }

  return [
    ...variants,
  ];
}

function simpleStem(
  token: string,
): string {
  if (
    token.endsWith("ies") &&
    token.length > 4
  ) {
    return `${token.slice(0, -3)}y`;
  }

  if (
    token.endsWith("ing") &&
    token.length > 5
  ) {
    return token.slice(0, -3);
  }

  if (
    token.endsWith("ed") &&
    token.length > 4
  ) {
    return token.slice(0, -2);
  }

  if (
    token.endsWith("es") &&
    token.length > 4
  ) {
    return token.slice(0, -2);
  }

  if (
    token.endsWith("s") &&
    token.length > 3
  ) {
    return token.slice(0, -1);
  }

  return token;
}

function buildPhrases(
  terms: string[],
): string[] {
  const phrases: string[] = [];

  for (
    let index = 0;
    index < terms.length - 1;
    index += 1
  ) {
    const first = terms[index];
    const second = terms[index + 1];

    if (
      first &&
      second
    ) {
      phrases.push(
        `${first} ${second}`,
      );
    }
  }

  return phrases;
}