import { Router } from "express";

import {
  askQuestion,
  navigateQuestionController,
} from "../controllers/qa.controller.js";

const router =
  Router();

router.post(
  "/ask",
  askQuestion,
);

router.post(
  "/navigate",
  navigateQuestionController,
);

export default router;