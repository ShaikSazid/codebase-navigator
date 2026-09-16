import { Router } from "express";
import { askRepositoryQuestion } from "../controllers/qa.controller.js";

const router = Router();

router.post("/ask", askRepositoryQuestion);

export default router;