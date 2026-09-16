import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import type { CodeSearchResult } from "./vector-search.service.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export async function generateAnswer(question: string, results: CodeSearchResult[]): Promise<string> {
    const context = results
        .map(
            (result) => `File: ${result.filePath}
    Lines: ${result.startLine}-${result.endLine}

    ${result.content}`,
        )
        .join("\n\n---\n\n");

    const prompt = `
You are an AI assistant that helps developers understand source code.

Answer the user's question using ONLY the provided code context.

Rules:
- Do not invent files, functions, behavior, or architecture.
- Do not use knowledge that is not present in the provided context.
- If the context is insufficient, clearly say that there is not enough evidence.
- When possible, mention the relevant file and line numbers.
- Explain the answer clearly for a developer who is unfamiliar with the codebase.

User question:
${question}

Code context:
${context}
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });

    const answer = response.text;

    if (!answer) {
        throw new Error("Gemini did not return an answer");
    }

    return answer;
}