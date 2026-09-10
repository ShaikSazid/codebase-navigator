import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
    req.log.info("Health check requested");
    res.status(200).json({ status: "Ok" });
});

export default router;