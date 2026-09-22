import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";

const port = Number(process.env.PORT) || 5003;

app.listen(port, "0.0.0.0", () => {
  console.log(
    `Agent orchestrator running on port ${port}`,
  );
});