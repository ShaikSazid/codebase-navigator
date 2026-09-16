import type { Request, Response } from "express";
import { answerQuestion } from "../services/qa.service";

export async function askQuestion(req: Request, res: Response) {
    try {
        const { question, repositoryId } = req.body;
        if(!question || !repositoryId) {
            return res.status(400).json({ message: "Question and repositoryId are required" });
        }
        const answer = await answerQuestion(question, repositoryId);
        return res.status(200).json({
            answer, repositoryId, question
        });
    } catch (error) {
        console.error("Q&A request failed", error);
        return res.status(500).json({ message: "Failed to answer question" });
    }
}