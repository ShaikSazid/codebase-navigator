import { GoogleGenAI } from "@google/genai";
import { config } from "../../config.js";
import type { RepoFileIndex } from "../../types/repo.js";
import type {
  ArchitectureMap,
  MapperInput,
} from "./mapper.types.js";
import { ArchitectureMapSchema } from "./mapper.schema.js";
import {
  validateArchitectureMapFiles,
} from "./mapper.validation.js";

const ai = new GoogleGenAI({
  apiKey: config.geminiApiKey,
});

async function generateMapperResponse(
  prompt: string,
  maxAttempts = 3,
) {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
    } catch (error) {
      lastError = error;

      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error
          ? error.status
          : undefined;

      const isRetryable =
  status === 503;

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = 1000 * 2 ** (attempt - 1);

      console.log(
        `Mapper Gemini request failed with ${status}. Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delay),
      );
    }
  }

  throw lastError;
}

export function detectStructuralPattern(
  repository: RepoFileIndex,
): boolean {
  const structuralSignals = [
    "frontend",
    "backend",
    "client",
    "server",
    "api",
    "routes",
    "controllers",
    "services",
    "models",
    "db",
    "database",
  ];

  const matchedSignals = new Set<string>();

  for (const file of repository.files) {
    const pathParts = file.path
      .toLowerCase()
      .split("/");

    for (const part of pathParts) {
      if (structuralSignals.includes(part)) {
        matchedSignals.add(part);
      }
    }
  }

  // Evidence from directory/file naming.
  const structuralSignalScore =
    Math.min(matchedSignals.size, 4);

  // Evidence from the dependency graph.
  const dependencyScore =
    repository.dependencyEdges.length > 0 ? 2 : 0;

  // A repository needs enough combined evidence
  // before we call it structurally organized.
  const totalScore =
    structuralSignalScore + dependencyScore;

  return totalScore >= 4;
}

export function countIncomingReferences(
  dependencyEdges: Array<{
    source: string;
    target: string;
  }>,
): Record<string, number> {
  const incomingCounts: Record<string, number> = {};

  for (const edge of dependencyEdges) {
    incomingCounts[edge.target] =
      (incomingCounts[edge.target] ?? 0) + 1;
  }

  return incomingCounts;
}

export function rankFilesByImportance(
  repository: RepoFileIndex,
): Array<{
  path: string;
  importanceScore: number;
}> {
  const incomingCounts = countIncomingReferences(
    repository.dependencyEdges,
  );

  const rankedFiles = repository.files.map((file) => ({
    path: file.path,
    importanceScore:
      incomingCounts[file.path] ?? 0,
  }));

  const maxReferences = Math.max(
    ...rankedFiles.map(
      (file) => file.importanceScore,
    ),
    0,
  );

  if (maxReferences === 0) {
    return rankedFiles;
  }

  return rankedFiles
    .map((file) => ({
      ...file,
      importanceScore:
        file.importanceScore / maxReferences,
    }))
    .sort(
      (a, b) =>
        b.importanceScore - a.importanceScore,
    );
}

export function applyDeterministicRanking(
  rankedFiles: Array<{
    path: string;
    importanceScore: number;
  }>,
  generatedFiles: Array<{
    path: string;
    importanceScore: number;
    reason: string;
  }>,
): Array<{
  path: string;
  importanceScore: number;
  reason: string;
}> {
  const generatedReasons = new Map(
    generatedFiles.map((file) => [
      file.path,
      file.reason,
    ]),
  );

  return rankedFiles.map((file) => ({
    path: file.path,
    importanceScore: file.importanceScore,
    reason:
      generatedReasons.get(file.path) ??
      "Importance determined from repository dependencies.",
  }));
}

function buildDeterministicArchitectureMap(
  repository: RepoFileIndex,
  isStructured: boolean,
  rankedFiles: Array<{
    path: string;
    importanceScore: number;
  }>,
): ArchitectureMap {
  /*
   * ------------------------------------------------------------
   * Structured repository fallback
   * ------------------------------------------------------------
   *
   * We cannot ask Gemini to semantically describe architecture
   * when Gemini is unavailable.
   *
   * Instead, deterministically group files by their top-level
   * directory. This gives the UI a useful repository map without
   * inventing architectural meaning.
   */
  if (isStructured) {
    const groups = new Map<string, string[]>();

    for (const file of repository.files) {
      const pathParts = file.path.split("/");

      const groupName =
        pathParts.length > 1
          ? pathParts[0]
          : "root";

      const existing =
        groups.get(groupName) ?? [];

      existing.push(file.path);

      groups.set(groupName, existing);
    }

    const layers = Array.from(
      groups.entries(),
    ).map(
      ([name, files]) => ({
        name,
        description:
          name === "root"
            ? "Files located at the repository root."
            : `Files grouped under the ${name} directory.`,
        files,
      }),
    );

    return {
      type: "structured",
      layers,
      summary:
        "Deterministic repository map generated from directory structure because the AI mapper was unavailable.",
    };
  }

  /*
   * ------------------------------------------------------------
   * Importance-ranked repository fallback
   * ------------------------------------------------------------
   */

  const incomingCounts =
    countIncomingReferences(
      repository.dependencyEdges,
    );

  const generatedFiles =
    rankedFiles.map((file) => {
      const incomingCount =
        incomingCounts[file.path] ?? 0;

      return {
        path: file.path,
        importanceScore:
          file.importanceScore,
        reason:
          incomingCount > 0
            ? `Referenced by ${incomingCount} internal file${
                incomingCount === 1
                  ? ""
                  : "s"
              } in the repository dependency graph.`
            : "No internal files reference this file; its importance score is based on available dependency evidence.",
      };
    });

  return {
    type: "importance-ranked",
    rankedFiles:
      applyDeterministicRanking(
        rankedFiles,
        generatedFiles,
      ),
    summary:
      "Deterministic file ranking generated from the repository dependency graph because the AI mapper was unavailable.",
  };
}

export async function runMapperAgent(
  input: MapperInput,
): Promise<ArchitectureMap> {
  const repository = input.repository;

  // Determine the architecture path using deterministic
  // repository analysis.
  const isStructured =
    detectStructuralPattern(repository);

  // Calculate deterministic importance scores.
  const rankedFiles =
    rankFilesByImportance(repository);

  const fileContext = repository.files
    .map(
      (file) => `FILE: ${file.path}
IMPORTS:
${
  file.imports.length > 0
    ? file.imports.join("\n")
    : "None"
}`,
    )
    .join("\n\n====================\n\n");

  const dependencyContext =
    repository.dependencyEdges
      .map(
        (edge) =>
          `${edge.source} -> ${edge.target}`,
      )
      .join("\n");

  const rankingContext = rankedFiles
    .map(
      (file) =>
        `${file.path} -> importanceScore: ${file.importanceScore}`,
    )
    .join("\n");

  const prompt = `
You are a software architecture analysis agent.

Your job is to analyze a software repository and produce
an architecture map.

Repository ID:
${repository.repositoryIndex}

Repository files and imports:
${fileContext}

Known internal dependency relationships:
${
  dependencyContext ||
  "No internal dependency relationships were found."
}

Deterministic structural analysis:
${
  isStructured
    ? "The repository has sufficient structural evidence."
    : "The repository does not have sufficient structural evidence."
}

Deterministic file importance ranking:
${rankingContext}

The application has already determined whether the repository
has a clear structure.

You MUST follow that determination.

If the deterministic structural analysis says the repository
has sufficient structural evidence, return:

{
  "type": "structured",
  "layers": [
    {
      "name": "Layer name",
      "description": "What this layer does",
      "files": [
        "path/to/file.ts"
      ]
    }
  ],
  "summary": "Short description of the repository architecture"
}

If the deterministic structural analysis says the repository
does NOT have sufficient structural evidence, return:

{
  "type": "importance-ranked",
  "rankedFiles": [
    {
      "path": "path/to/file.ts",
      "importanceScore": 0,
      "reason": "Why this file appears important"
    }
  ],
  "summary": "Short explanation of the repository structure"
}

For the importance-ranked response:
- Use the exact file paths from the deterministic file importance ranking.
- Use the exact importanceScore provided by the deterministic ranking.
- Do NOT change, recalculate, or invent importance scores.
- Only provide the explanation/reason for why each ranked file is important.
- Preserve the ranking order provided by the deterministic ranking.

Rules:
- Use ONLY the provided repository information.
- Do not invent files.
- Do not invent dependencies.
- Internal dependency relationships provided above are authoritative.
- Do not treat external packages such as express, react, or axios
  as internal repository files.
- Follow the deterministic structural analysis.
- The importance score must be between 0 and 1.
- Always include "summary".
- Always include either "layers" or "rankedFiles", depending on the type.
- Return ONLY valid JSON.
`;

  let response;

try {
  response =
    await generateMapperResponse(prompt);
} catch (error) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error
      ? error.status
      : undefined;

  if (
    status === 429 ||
    status === 503
  ) {
    console.warn(
      `Mapper Gemini unavailable with status ${status}. Using deterministic fallback.`,
    );

    return buildDeterministicArchitectureMap(
      repository,
      isStructured,
      rankedFiles,
    );
  }

  throw error;
}

const text = response.text;

  if (!text) {
    throw new Error(
      "Mapper agent did not return a response",
    );
  }

  try {
    const parsed = JSON.parse(text);

    const result =
      ArchitectureMapSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(
        `Mapper agent returned invalid schema: ${result.error.message}`,
      );
    }

    // Gemini must follow our deterministic decision.
    if (
      isStructured &&
      result.data.type !== "structured"
    ) {
      throw new Error(
        "Mapper agent returned an importance-ranked result for a structured repository.",
      );
    }

    if (
      !isStructured &&
      result.data.type !== "importance-ranked"
    ) {
      throw new Error(
        "Mapper agent returned a structured result for an unclear repository.",
      );
    }

    // Verify that Gemini only references files that actually
    // exist in the repository.
    validateArchitectureMapFiles(
      result.data,
      repository,
    );

    // Gemini provides explanations, but our application
    // controls the importance scores.
    if (result.data.type === "importance-ranked") {
      return {
        ...result.data,
        rankedFiles: applyDeterministicRanking(
          rankedFiles,
          result.data.rankedFiles,
        ),
      };
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "Mapper agent returned invalid JSON",
      );
    }

    throw error;
  }
}