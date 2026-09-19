import { GoogleGenAI } from "@google/genai";

import { config } from "../../config.js";
import {
  FileExplanationSchema,
  type FileExplanation,
} from "./explainer.schema.js";
import type { ExplainerInput } from "./explainer.types.js";

const ai = new GoogleGenAI({
  apiKey: config.geminiApiKey,
});

async function generateExplainerResponse(
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
        status === 429 || status === 503;

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const delay =
        1000 * 2 ** (attempt - 1);

      console.warn(
        `Explainer Gemini request failed with ${status}. Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delay),
      );
    }
  }

  throw lastError;
}

export async function runExplainerAgent(
  input: ExplainerInput,
): Promise<FileExplanation> {
  if (!input.filePath.trim()) {
    throw new Error("File path is required");
  }

  if (!input.content.trim()) {
    throw new Error("File content is required");
  }

  const dependencies =
    input.dependencies?.length
      ? input.dependencies.join("\n")
      : "No dependency information provided.";

  const repositoryContext =
    input.repositoryContext?.trim() ||
    "No additional repository context provided.";

  const language =
    input.language?.trim() ||
    "Unknown";

  const usedBy =
    input.usedBy?.length
      ? input.usedBy.join("\n")
      : "No caller information provided.";

  const symbols =
    input.symbols?.length
      ? input.symbols
        .map(
          (symbol) =>
            `- ${symbol.name} (${symbol.kind}) lines ${symbol.startLine}-${symbol.endLine}${symbol.signature
              ? ` — ${symbol.signature}`
              : ""
            }`,
        )
        .join("\n")
      : "No symbol information provided.";

  const prompt = `
You are an AI software code explanation agent inside a developer
onboarding platform.

Your job is to explain ONE source file to a developer who is unfamiliar
with the repository.

The explanation must help the developer answer these questions:

1. What is this file?
2. Why does this file exist?
3. What does this file do?
4. How does the code work?
5. Where does this file fit in the repository?
6. What other parts of the repository use it?
7. What important concepts should a developer understand?

--------------------------------------------------
FILE
--------------------------------------------------

File path:
${input.filePath}

--------------------------------------------------
KNOWN DEPENDENCIES
--------------------------------------------------

${dependencies}

--------------------------------------------------
CODE INTELLIGENCE
--------------------------------------------------

Language:
${language}

SYMBOLS DEFINED IN THIS FILE:
${symbols}

USED BY:
${usedBy}

--------------------------------------------------
REPOSITORY CONTEXT
--------------------------------------------------

${repositoryContext}

--------------------------------------------------
SOURCE CODE
--------------------------------------------------

${truncateContent(input.content)}

--------------------------------------------------
OUTPUT FORMAT
--------------------------------------------------

Return ONLY valid JSON matching this exact structure:

{
  "filePath": "string",
  "fileRole": "string",
  "whyExists": "string",
  "responsibilities": [
    "string"
  ],
  "keyFunctions": [
    {
      "name": "string",
      "explanation": "string"
    }
  ],
  "dataFlow": "string",
  "usedBy": [
    "string"
  ],
  "keyConcepts": [
    {
      "name": "string",
      "explanation": "string"
    }
  ],
  "uncertainty": [
    "string"
  ]
}

--------------------------------------------------
RULES
--------------------------------------------------

1. Use ONLY the supplied source code, known dependencies, and repository
   context.

2. Do NOT invent files, functions, dependencies, callers, routes,
   architecture, behavior, or relationships.

3. "filePath" MUST exactly match:
   ${input.filePath}

4. "fileRole" should explain what this file is in the repository.
   Keep it concise and based on actual evidence.

5. "whyExists" should explain the architectural or functional reason
   this file exists. Base this on the source code and repository context.
   Do not assume a reason that is not supported by evidence.

6. "responsibilities" should contain the main responsibilities actually
   handled by this file.

7. "keyFunctions" must contain only important functions, methods,
   handlers, classes, or other executable units that actually appear in
   the supplied source code.

8. For every key function, explain what the code actually does.
   Do not describe hypothetical behavior.

9. "dataFlow" should describe the important flow through the file.
   Explain what enters the file, what important operations occur, what
   other components are called, and what is returned or produced.

10. "usedBy" must contain only files, modules, routes, or other callers
    explicitly supported by the supplied repository context.

11. If the repository context does not provide reliable information about
    what uses this file, return an empty "usedBy" array.

12. "keyConcepts" should identify concepts that are clearly present in the
    code and useful for a developer learning the repository.

13. Do not add generic programming concepts unless they are genuinely
    relevant to understanding this specific file.

14. "uncertainty" must contain specific uncertainties whenever important
    information cannot be determined from the supplied evidence.

15. Do not hide uncertainty behind confident wording.

16. Do not use phrases such as "likely", "probably", or "may be used by"
    to present unsupported claims as facts. Put those limitations into
    "uncertainty" instead.

17. If there is insufficient evidence for a section, provide the most
    conservative explanation supported by the evidence and record the
    limitation in "uncertainty".

18. Keep the explanation useful for a developer onboarding onto the
    repository.

19. Return ONLY valid JSON.
`;

  const response =
    await generateExplainerResponse(prompt);

  const text = response.text;

  if (!text) {
    throw new Error(
      "Explainer agent did not return a response",
    );
  }

  try {
    const parsed = JSON.parse(
      cleanJson(text),
    );

    const result =
      FileExplanationSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(
        `Explainer agent returned invalid schema: ${result.error.message}`,
      );
    }

    if (
      result.data.filePath !==
      input.filePath
    ) {
      throw new Error(
        "Explainer agent returned an incorrect file path.",
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "Explainer agent returned invalid JSON",
      );
    }

    throw error;
  }
}

function cleanJson(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function truncateContent(
  content: string,
  maxChars = 12000,
): string {
  if (content.length <= maxChars) {
    return content;
  }

  const half = Math.floor(
    maxChars / 2,
  );

  return `${content.slice(
    0,
    half,
  )}

/* ... middle of file truncated ... */

${content.slice(-half)}`;
}