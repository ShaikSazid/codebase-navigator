import { Router } from "express";

import {
  explainRepositoryFile,
} from "../controllers/explainer.controller.js";

const router = Router();

router.post(
  "/",
  explainRepositoryFile,
);

export default router;