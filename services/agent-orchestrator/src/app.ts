import express from "express";
import { runMapperAgent } from "./agents/mapper/mapper.agent.js";
import type { MapperInput } from "./agents/mapper/mapper.types.js";

import { runExplainerAgent } from "./agents/explainer/explainer.agent.js";
import type { ExplainerInput } from "./agents/explainer/explainer.types.js";

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

app.post("/internal/explain", async (req, res) => {
  try {
    const input = req.body as ExplainerInput;

    if (!input.filePath || !input.content) {
      return res.status(400).json({
        message: "File path and file content are required",
      });
    }

    const explanation = await runExplainerAgent(input);

    return res.status(200).json({
      message: "File explanation completed",
      explanation,
    });
  } catch (error) {
    console.error(
      "File explanation failed",
      error,
    );

    return res.status(500).json({
      message: "File explanation failed",
    });
  }
});

export default app;