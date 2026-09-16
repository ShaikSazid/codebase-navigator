import dotenv from "dotenv";
dotenv.config();

export const config = {
    geminiApiKey: process.env.GEMINI_API_KEY,
    chromaHost: process.env.CHROMA_HOST || "localhost",
    chromaPort: Number(process.env.CHROMA_PORT || 8080),
};