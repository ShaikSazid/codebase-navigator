import express from "express";

import {
  getRepositoryFile,
  getRepositoryFileContext,
  ingestRepository,
  getRepositoryIndex
} from "./services/ingestion.service.js";

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
      architectureMap:
        result.architectureMap,
      repositoryTree:
        result.repositoryTree,
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

app.get(
  "/internal/repository-index/:repositoryId",
  (req, res) => {
    const repositoryIndex =
      getRepositoryIndex(
        req.params.repositoryId,
      );

    if (!repositoryIndex) {
      return res.status(404).json({
        message:
          "Repository index not found",
      });
    }

    return res.status(200).json({
      repositoryIndex,
    });
  },
);

app.get(
  "/internal/repositories/:repositoryId/files",
  (req, res) => {
    try {
      const { repositoryId } = req.params;
      const filePath = req.query.path;

      if (
        typeof filePath !== "string" ||
        !filePath
      ) {
        return res.status(400).json({
          message: "File path is required",
        });
      }

      const file =
        getRepositoryFile(
          repositoryId,
          filePath,
        );

      if (!file) {
        return res.status(404).json({
          message: "Repository file not found",
        });
      }

      return res.status(200).json({
        path: file.path,
        content: file.content,
      });
    } catch (error) {
      console.error(
        "Repository file retrieval failed",
        error,
      );

      return res.status(500).json({
        message:
          "Repository file retrieval failed",
      });
    }
  },
);


app.get(
  "/internal/repositories/:repositoryId/files/context",
  (req, res) => {
    try {
      const { repositoryId } = req.params;
      const filePath = req.query.path;

      if (
        typeof filePath !== "string" ||
        !filePath
      ) {
        return res.status(400).json({
          message: "File path is required",
        });
      }

      const context = getRepositoryFileContext(
        repositoryId,
        filePath,
      );

      if (!context) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      return res.json(context);
    } catch (error) {
      console.error(
        "Repository file context retrieval failed",
        error,
      );

      return res.status(500).json({
        message:
          "Repository file context retrieval failed",
      });
    }
  },
);

export default app;