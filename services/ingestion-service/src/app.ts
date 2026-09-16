import express from "express";

import { ingestRepository } from "./services/ingestion.service.js";

const app = express();

app.use(express.json());

app.post("/internal/ingest", async (req, res) => {
  try {
    const { url, repositoryId } = req.body;

    if (!url || !repositoryId) {
      return res.status(400).json({
        message: "Url and RepositoryId are required",
      });
    }

    const result = await ingestRepository(
      url,
      repositoryId,
    );

    return res.status(200).json({
      message: "Repository ingestion completed",
      repositoryId,
      architectureMap: result.architectureMap,
      repositoryTree: result.repositoryTree,
    });
  } catch (error) {
    console.error(
      "Repository ingestion failed",
      error,
    );

    return res.status(500).json({
      message: "Repository ingestion failed",
    });
  }
});

export default app;