import dotenv from "dotenv";
dotenv.config();

import express from "express";
import logger from "./logger/index.js";
import qaRoutes from "./routes/qa.routes.js";

const app = express();

app.use(express.json());

app.use("/api/qa", qaRoutes);

const PORT = process.env.PORT || 5002;

app.listen(PORT, () =>
  logger.info(`Q&A service running on port ${PORT}`),
);