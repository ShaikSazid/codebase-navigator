import { QdrantClient } from "@qdrant/js-client-rest";

import { generateEmbedding } from "./embedding.service.js";

export interface CodeSearchResult {
  chunkId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  distance: number;
}

const client = new QdrantClient({
  url:
    process.env.QDRANT_URL ||
    "http://localhost:6333",

  apiKey:
    process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME =
  "codebase_chunks_384";

export async function searchCode(
  query: string,
  repositoryId: string,
  limit = 5,
): Promise<CodeSearchResult[]> {
  const queryEmbedding =
    await generateEmbedding(query);

  const result =
    await client.query(
      COLLECTION_NAME,
      {
        query:
          queryEmbedding,

        limit,

        filter: {
          must: [
            {
              key: "repositoryId",
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

  return result.points.map(
    (point) => {
      const payload =
        point.payload ?? {};

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
          1 -
          Number(
            point.score ?? 0,
          ),
      };
    },
  );
}