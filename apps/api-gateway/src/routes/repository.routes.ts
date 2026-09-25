import { Router } from "express";

import {
  createRepository,
  getRepositoryStatus,
  getRepositoryFileContent,
} from "../controllers/repository.controller.js";

const router = Router();

router.post("/", createRepository);

router.get(
  "/:repositoryId/files",
  getRepositoryFileContent,
);

router.get(
  "/:jobId",
  getRepositoryStatus,
);

export default router;