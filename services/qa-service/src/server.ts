import "dotenv/config";

import express from "express";
import logger from "./logger/index.js";
import qaRoutes from "./routes/qa.routes.js";

const app = express();

app.use((req, res, next) => {
  console.log(
    `[HTTP] ${req.method} ${req.originalUrl}`,
  );

  res.on("finish", () => {
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode}`,
    );
  });

  next();
});

app.use(express.json());

app.use("/api/qa", qaRoutes);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Q/A service",
  });
});

const PORT = Number(process.env.PORT) || 5002;

app.listen(PORT, "0.0.0.0", () =>
  logger.info(`Q&A service running on port ${PORT}`),
);