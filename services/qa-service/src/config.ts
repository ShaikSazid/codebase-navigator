import dotenv from "dotenv";

dotenv.config();

export const config = {
  geminiApiKey:
    process.env.GEMINI_API_KEY,

  qdrantUrl:
    process.env.QDRANT_URL ||
    "http://localhost:6333",

  qdrantApiKey:
    process.env.QDRANT_API_KEY,
};