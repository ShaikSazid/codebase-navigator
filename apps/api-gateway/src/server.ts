import "dotenv/config";

import cors from "cors";
import app from "./app.js";
import logger from "./logger/index.js";

const allowedOrigins = (
  process.env.FRONTEND_URL ?? "http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

const port = Number(process.env.PORT) || 5000;

app.listen(port, "0.0.0.0", () => {
  logger.info(`Server running on port ${port}`);
});