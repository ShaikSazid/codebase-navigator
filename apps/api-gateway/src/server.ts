import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import logger from "./logger/index.js";

const port = process.env.PORT || 5000;

app.listen(port, () => {
    logger.info(`Server running on the port ${port}`);
});