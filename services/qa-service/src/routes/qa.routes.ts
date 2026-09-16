import { Router } from "express";
import { askQuestion } from "../controllers/qa.controller";

const router = Router();

router.post("/ask", askQuestion);

export default router;