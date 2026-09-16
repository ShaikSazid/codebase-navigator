import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";

const port = process.env.PORT || 5003;

app.listen(port, () => {
  console.log(
    `Agent orchestrator running on port ${port}`,
  );
});