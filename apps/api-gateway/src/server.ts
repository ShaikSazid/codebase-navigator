import "dotenv/config";

import app from "./app.js";
import logger from "./logger/index.js";

import cors from "cors";

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:127.0.0.1:5173")
                .split(",")
                .map((origin) => origin.trim())
                .filter(Boolean);

const port = Number(process.env.PORT) || 5000;

app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on the port ${port}`)
    logger.info(`Server running on the port ${port}`);
});