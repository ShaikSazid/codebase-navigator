import {
  env,
  pipeline,
} from "@huggingface/transformers";

const EMBEDDING_MODEL =
  "onnx-community/all-MiniLM-L6-v2-ONNX";

const EMBEDDING_DIMENSION = 384;

env.cacheDir =
  process.env.HF_CACHE_DIR ??
  "./.cache/huggingface";

type EmbeddingPipeline =
  Awaited<
    ReturnType<
      typeof pipeline<
        "feature-extraction"
      >
    >
  >;

let embeddingPipeline:
  | EmbeddingPipeline
  | null = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline =
      await pipeline(
        "feature-extraction",
        EMBEDDING_MODEL,
      );
  }

  return embeddingPipeline;
}

export async function generateQueryEmbedding(
  text: string,
): Promise<number[]> {
  const normalizedText =
    text.trim();

  if (!normalizedText) {
    throw new Error(
      "Cannot generate embedding for empty text",
    );
  }

  const extractor =
    await getEmbeddingPipeline();

  const output =
    await extractor(
      normalizedText,
      {
        pooling: "mean",
        normalize: true,
      },
    );

  const values =
    output.tolist();

  const embedding =
    values[0] as number[];

  if (
    !embedding ||
    embedding.length !==
      EMBEDDING_DIMENSION
  ) {
    throw new Error(
      `Expected embedding dimension ${EMBEDDING_DIMENSION}, received ${
        embedding?.length ?? 0
      }`,
    );
  }

  return embedding;
}