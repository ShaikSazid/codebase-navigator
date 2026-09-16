import express from "express";
import { runMapperAgent } from "./agents/mapper/mapper.agent.js";
import type { MapperInput } from "./agents/mapper/mapper.types.js";

const app = express();

app.use(express.json());

app.post("/internal/map", async (req, res) => {
  try {
    const input = req.body as MapperInput;

    if (!input.repository) {
      return res.status(400).json({
        message: "Repository index is required",
      });
    }

    const architectureMap = await runMapperAgent(input);

    return res.status(200).json({
      message: "Repository mapping completed",
      architectureMap,
    });
  } catch (error) {
    console.error("Repository mapping failed", error);

    return res.status(500).json({
      message: "Repository mapping failed",
    });
  }
});

export default app;