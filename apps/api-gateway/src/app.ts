import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";

import logger from "./logger/index.js";
import healthRoutes from "./routes/health.routes.js";
import repositoryRoutes from "./routes/repository.routes.js";
import qaRoutes from "./routes/qa.routes.js";
import explainerRoutes from "./routes/explainer.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  pinoHttp({
    logger,

    customReceivedMessage: (req) => {
      return `${req.method} ${req.originalUrl}`;
    },

    customSuccessMessage: (req, res, responseTime) => {
      return `${req.method} ${req.originalUrl} → ${res.statusCode} (${responseTime}ms)`;
    },

    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) {
        return "error";
      }

      if (res.statusCode >= 400) {
        return "warn";
      }

      return "info";
    },

    serializers: {
      req: () => undefined,
      res: () => undefined,
    },

    customSuccessObject: () => ({}),
  })
);

app.use("/api/health", healthRoutes);
app.use("/api/repositories", repositoryRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/explainer", explainerRoutes);

export default app;