import { Router } from "express";

const router = Router();

import { createRepository, getRepositoryFileContent } from "../controllers/repository.controller.js";
import { getRepositoryStatus } from "../controllers/repository-status.controller.js";

router.post("/", createRepository);
router.get("/:jobId", getRepositoryStatus);
router.get("/:repositoryId/files", getRepositoryFileContent);

export default router;