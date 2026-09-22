import "dotenv/config";

import app from "./app.js";
import logger from "./logger/index.js";

const port = Number(process.env.PORT) || 5001;

app.listen(port, "0.0.0.0", () => {
    logger.info(`Ingestion service running on port ${port}`);
});