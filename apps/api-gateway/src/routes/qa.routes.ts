import { Router } from "express";

import {
  askRepositoryQuestion,
  navigateRepositoryQuestion,
} from "../controllers/qa.controller.js";

const router = Router();

router.post(
  "/ask",
  askRepositoryQuestion,
);

router.post(
  "/navigate",
  navigateRepositoryQuestion,
);

export default router;