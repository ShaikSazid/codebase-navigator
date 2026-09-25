import express from "express";

import {
  getRepositoryFile,
  getRepositoryFileContext,
  ingestRepository,
  getRepositoryIndex,
  getRepositoryAnalysisMetadata,
} from "./services/ingestion.service.js";

const app = express();

app.use(express.json());

app.get(
  "/api/health",
  (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "ingestion-service",
    });
  },
);


app.post(
  "/internal/ingest",
  async (req, res) => {
    try {
      const {
        url,
        repositoryId,
      } = req.body;

      if (!url || !repositoryId) {
        return res.status(400).json({
          message:
            "Url and RepositoryId are required",
        });
      }

      const result =
        await ingestRepository(
          url,
          repositoryId,
        );

      return res.status(200).json({
        message:
          "Repository ingestion completed",
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
        message:
          "Repository ingestion failed",
      });
    }
  },
);


app.get(
  "/internal/repositories/:repositoryId/status",
  async (req, res) => {
    try {
      const {
        repositoryId,
      } = req.params;

      const metadata =
        await getRepositoryAnalysisMetadata(
          repositoryId,
        );

      if (!metadata) {
        return res.status(404).json({
          message:
            "Repository metadata not found",
        });
      }

      return res.status(200).json(
        metadata,
      );
    } catch (error) {
      console.error(
        "Repository metadata retrieval failed",
        error,
      );

      return res.status(500).json({
        message:
          "Repository metadata retrieval failed",
      });
    }
  },
);


app.get(
  "/internal/repository-index/:repositoryId",
  async (req, res) => {
    try {
      const repositoryIndex =
        await getRepositoryIndex(
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
    } catch (error) {
      console.error(
        "Repository index retrieval failed",
        error,
      );

      return res.status(500).json({
        message:
          "Repository index retrieval failed",
      });
    }
  },
);


app.get(
  "/internal/repositories/:repositoryId/files",
  async (req, res) => {
    try {
      const {
        repositoryId,
      } = req.params;

      const filePath =
        req.query.path;

      if (
        typeof filePath !== "string" ||
        !filePath
      ) {
        return res.status(400).json({
          message:
            "File path is required",
        });
      }

      const file =
        await getRepositoryFile(
          repositoryId,
          filePath,
        );

      if (!file) {
        return res.status(404).json({
          message:
            "Repository file not found",
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
  async (req, res) => {
    try {
      const {
        repositoryId,
      } = req.params;

      const filePath =
        req.query.path;

      if (
        typeof filePath !== "string" ||
        !filePath
      ) {
        return res.status(400).json({
          message:
            "File path is required",
        });
      }

      const context =
        await getRepositoryFileContext(
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