import axios from "axios";
import logger from "../logger/index.js";

const AGENT_ORCHESTRATOR_URL =
  process.env.AGENT_ORCHESTRATOR_URL ||
  "http://localhost:5003";

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL ||
  "http://localhost:5001";

const EXPLAINER_TIMEOUT_MS = 60_000;

export interface ExplainFileInput {
  repositoryId: string;
  filePath: string;
  content: string;
  dependencies?: string[];
  repositoryContext?: string;
}

interface RepositoryFileContextResponse {
  filePath: string;
  language?: string;
  dependencies: string[];
  usedBy: string[];
  symbols: Array<{
    name: string;
    kind: string;
    startLine: number;
    endLine: number;
    signature?: string;
  }>;
}

export async function explainFile(
  input: ExplainFileInput,
) {
  logger.info(
    {
      repositoryId: input.repositoryId,
      filePath: input.filePath,
    },
    "Preparing file explanation request",
  );

  let repositoryFileContext:
    | RepositoryFileContextResponse
    | null = null;

  try {
    const response =
      await axios.get<RepositoryFileContextResponse>(
        `${INGESTION_SERVICE_URL}/internal/repositories/${encodeURIComponent(
          input.repositoryId,
        )}/files/context`,
        {
          params: {
            path: input.filePath,
          },
          timeout: 15_000,
        },
      );

    repositoryFileContext = response.data;

    logger.info(
      {
        repositoryId: input.repositoryId,
        filePath: input.filePath,
        dependencyCount:
          repositoryFileContext.dependencies.length,
        usedByCount:
          repositoryFileContext.usedBy.length,
        symbolCount:
          repositoryFileContext.symbols.length,
      },
      "Repository file context loaded",
    );
  } catch (error) {
    logger.warn(
      {
        repositoryId: input.repositoryId,
        filePath: input.filePath,
        error: axios.isAxiosError(error)
          ? {
              message: error.message,
              code: error.code,
              status: error.response?.status,
              responseData: error.response?.data,
            }
          : error instanceof Error
            ? error.message
            : String(error),
      },
      "Unable to load repository file context",
    );
  }

  const combinedContext = [
    input.repositoryContext
      ? `ARCHITECTURE CONTEXT\n${input.repositoryContext}`
      : "",

    repositoryFileContext
      ? [
          "CODE INTELLIGENCE CONTEXT",

          `Language: ${
            repositoryFileContext.language ?? "unknown"
          }`,

          "Symbols defined in this file:",
          repositoryFileContext.symbols
            .map(
              (symbol) =>
                `- ${symbol.name} (${symbol.kind}) lines ${symbol.startLine}-${symbol.endLine}${
                  symbol.signature
                    ? ` — ${symbol.signature}`
                    : ""
                }`,
            )
            .join("\n"),

          "Dependencies:",
          repositoryFileContext.dependencies
            .map((dependency) => `- ${dependency}`)
            .join("\n"),

          "Used by:",
          repositoryFileContext.usedBy
            .map((file) => `- ${file}`)
            .join("\n"),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const orchestratorInput = {
    filePath: input.filePath,
    content: input.content,

    dependencies:
      repositoryFileContext?.dependencies ??
      input.dependencies ??
      [],

    repositoryContext:
      combinedContext ||
      "No additional repository context provided.",

    language: repositoryFileContext?.language,

    usedBy: repositoryFileContext?.usedBy ?? [],

    symbols: repositoryFileContext?.symbols ?? [],
  };

  logger.info(
    {
      repositoryId: input.repositoryId,
      filePath: input.filePath,
      orchestratorUrl: AGENT_ORCHESTRATOR_URL,
      contentLength: input.content.length,
    },
    "Sending enriched file explanation request to agent orchestrator",
  );

  try {
    const response = await axios.post(
      `${AGENT_ORCHESTRATOR_URL}/internal/explain`,
      orchestratorInput,
      {
        timeout: EXPLAINER_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    logger.info(
      {
        repositoryId: input.repositoryId,
        filePath: input.filePath,
        status: response.status,
      },
      "File explanation generated successfully",
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          repositoryId: input.repositoryId,
          filePath: input.filePath,
          orchestratorUrl: AGENT_ORCHESTRATOR_URL,
          status: error.response?.status,
          responseData: error.response?.data,
          errorCode: error.code,
          message: error.message,
        },
        "Agent orchestrator file explanation failed",
      );
    } else {
      logger.error(
        {
          repositoryId: input.repositoryId,
          filePath: input.filePath,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        "Unexpected file explanation failure",
      );
    }

    throw error;
  }
}