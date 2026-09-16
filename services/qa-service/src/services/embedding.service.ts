import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export async function generateQueryEmbedding(text: string): Promise<number[]> {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
            outputDimensionality: 768,
        }
    });
    if (!response.embeddings?.[0]?.values) {
        throw new Error(
            "Gemini did not return an embedding"
        );
    }

    return response.embeddings[0].values;
}