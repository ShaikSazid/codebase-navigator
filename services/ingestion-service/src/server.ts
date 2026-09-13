import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import logger from "./logger/index.js";

const port = process.env.PORT || 5001;

app.listen(port, () => {
    logger.info(`Ingestion service running on port ${port}`);
});