import { Router } from "express";

const router = Router();

import { createRepository } from "../controllers/repository.controller.js";
import { getRepositoryStatus } from "../controllers/repository-status.controller.js";

router.post("/", createRepository);
router.get("/:jobId", getRepositoryStatus);

export default router;