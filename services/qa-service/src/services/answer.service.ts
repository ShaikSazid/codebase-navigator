import { GoogleGenAI } from "@google/genai";

import { config } from "../config.js";

import type {
  CodeSearchResult,
} from "./vector-search.service.js";

import type {
  RepositoryIndex,
} from "./repository-context.service.js";

const ai =
  new GoogleGenAI({
    apiKey:
      config.geminiApiKey,
  });

export async function generateAnswer(
  question: string,
  results: CodeSearchResult[],
  repositoryIndex:
    | RepositoryIndex
    | null,
): Promise<string> {
  const codeContext =
    results
      .map(
        (result) =>
          `File: ${result.filePath}
Lines: ${result.startLine}-${result.endLine}

${result.content}`,
      )
      .join(
        "\n\n---\n\n",
      );

  const graphContext =
    buildGraphContext(
      question,
      results,
      repositoryIndex,
    );

  const prompt = `
You are an AI assistant that helps developers understand source code.

Answer the user's question using ONLY the provided repository context.

The repository context may contain:
1. Retrieved source-code chunks.
2. Structured code relationships.
3. Data models and their fields.

Rules:
- Do not invent files, functions, models, fields, relationships, behavior, or architecture.
- Do not use outside knowledge.
- Prefer direct source-code evidence when available.
- When a question asks about a data model, use the structured data model definition as the primary source.
- When a question asks about fields, list only fields explicitly present in the provided model definition.
- When a question asks which files use a model, only report files supported by explicit relationships or source-code evidence.
- When a model exists in the structured repository context but no usage relationship is available, clearly say that usage could not be established from the indexed relationships.
- When possible, mention file paths and line numbers.
- If the context is insufficient, clearly say that there is not enough evidence.
- Explain the answer clearly for a developer who is unfamiliar with the codebase.

User question:
${question}

Retrieved source code:
${codeContext}

Structured repository context:
${graphContext}
`;

  const response =
    await ai.models.generateContent({
      model:
        "gemini-2.5-flash",
      contents:
        prompt,
    });

  const answer =
    response.text;

  if (!answer) {
    throw new Error(
      "Gemini did not return an answer",
    );
  }

  return answer;
}

function buildGraphContext(
  question: string,
  results: CodeSearchResult[],
  repositoryIndex:
    | RepositoryIndex
    | null,
): string {
  if (!repositoryIndex) {
    return "Repository index is not available.";
  }

  const relevantFiles =
    new Set(
      results.map(
        (result) =>
          result.filePath,
      ),
    );

  const modelQuestion =
    isModelQuestion(
      question,
    );

  const relevantFileEntries =
    repositoryIndex.files.filter(
      (file) =>
        relevantFiles.has(
          file.path,
        ),
    );

  const relevantRelationships =
    repositoryIndex.relationships.filter(
      (relationship) =>
        isRelationshipRelevant(
          relationship,
          relevantFiles,
        ),
    );

  const allModels =
    repositoryIndex.dataModels ??
    [];

  const modelsToInclude =
    modelQuestion
      ? allModels
      : allModels.filter(
          (model) =>
            relevantFiles.has(
              model.filePath,
            ) ||
            relevantRelationships.some(
              (relationship) =>
                relationship.source.includes(
                  model.id,
                ) ||
                relationship.target.includes(
                  model.id,
                ),
            ),
        );

  const modelIds =
    new Set(
      modelsToInclude.map(
        (model) =>
          model.id,
      ),
    );

  const modelRelationships =
    repositoryIndex.relationships.filter(
      (relationship) =>
        modelIds.has(
          relationship.source,
        ) ||
        modelIds.has(
          relationship.target,
        ) ||
        modelsToInclude.some(
          (model) =>
            relationship.source.includes(
              model.id,
            ) ||
            relationship.target.includes(
              model.id,
            ),
        ),
    );

  const output: string[] =
    [];

  if (
    relevantFileEntries.length >
    0
  ) {
    output.push(
      "Relevant files:",
    );

    for (
      const file of
        relevantFileEntries
    ) {
      output.push(
        JSON.stringify(
          {
            path:
              file.path,
            language:
              file.language,
            imports:
              file.imports,
            symbols:
              file.symbols ??
              [],
          },
          null,
          2,
        ),
      );
    }
  }

  if (
    relevantRelationships.length >
    0
  ) {
    output.push(
      "\nRelevant relationships:",
    );

    for (
      const relationship of
        relevantRelationships
    ) {
      output.push(
        JSON.stringify(
          relationship,
          null,
          2,
        ),
      );
    }
  }

  if (
    modelsToInclude.length >
    0
  ) {
    output.push(
      "\nData models:",
    );

    for (
      const model of
        modelsToInclude
    ) {
      output.push(
        JSON.stringify(
          model,
          null,
          2,
        ),
      );
    }
  }

  if (
    modelRelationships.length >
    0
  ) {
    output.push(
      "\nData-model relationships:",
    );

    for (
      const relationship of
        modelRelationships
    ) {
      output.push(
        JSON.stringify(
          relationship,
          null,
          2,
        ),
      );
    }
  }

  if (
    repositoryIndex.dataModels
      ?.length
  ) {
    output.push(
      `\nTotal repository data models: ${repositoryIndex.dataModels.length}`,
    );
  }

  return (
    output.join("\n") ||
    "No structured repository context was found."
  );
}

function isModelQuestion(
  question: string,
): boolean {
  return /\b(model|models|schema|schemas|field|fields|column|columns|table|tables|collection|collections|entity|entities|orm|database model|data model)\b/i.test(
    question,
  );
}

function isRelationshipRelevant(
  relationship: {
    source: string;
    target: string;
    evidence?: {
      filePath?: string;
    };
  },
  relevantFiles: Set<string>,
): boolean {
  if (
    relationship.evidence?.filePath &&
    relevantFiles.has(
      relationship.evidence
        .filePath,
    )
  ) {
    return true;
  }

  for (
    const filePath of
      relevantFiles
  ) {
    if (
      relationship.source.includes(
        filePath,
      ) ||
      relationship.target.includes(
        filePath,
      )
    ) {
      return true;
    }
  }

  return false;
}