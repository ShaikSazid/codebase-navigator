import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

export async function generateEmbedding(
  text: string,
): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    },
  });

  if (!response.embeddings?.[0]?.values) {
    throw new Error(
      "Gemini did not return an embedding",
    );
  }

  return response.embeddings[0].values;
}

export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    },
  });

  const embeddings = response.embeddings;

  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error(
      "Gemini did not return embeddings for all inputs",
    );
  }

  return embeddings.map((embedding) => {
    if (!embedding.values) {
      throw new Error(
        "Gemini returned an embedding without values",
      );
    }

    return embedding.values;
  });
}