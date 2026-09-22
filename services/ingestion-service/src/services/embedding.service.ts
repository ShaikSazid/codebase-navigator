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

export async function generateEmbedding(
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

export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const normalizedTexts =
    texts.map((text) =>
      text.trim(),
    );

  if (
    normalizedTexts.some(
      (text) => !text,
    )
  ) {
    throw new Error(
      "Cannot generate embeddings for empty text",
    );
  }

  const extractor =
    await getEmbeddingPipeline();

  const output =
    await extractor(
      normalizedTexts,
      {
        pooling: "mean",
        normalize: true,
      },
    );

  const values =
    output.tolist() as number[][];

  if (
    values.length !==
    normalizedTexts.length
  ) {
    throw new Error(
      "Embedding count does not match input count",
    );
  }

  for (
    const embedding of values
  ) {
    if (
      embedding.length !==
      EMBEDDING_DIMENSION
    ) {
      throw new Error(
        `Expected embedding dimension ${EMBEDDING_DIMENSION}, received ${embedding.length}`,
      );
    }
  }

  return values;
}