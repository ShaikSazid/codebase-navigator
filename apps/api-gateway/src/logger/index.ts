import pino from "pino";
import pretty from "pino-pretty";
import { Writable } from "stream";
import fs from "fs";
import path from "path";

const logFilePath = path.join(process.cwd(), "logs", "app.log");
const fileStream = fs.createWriteStream(logFilePath, { flags: "a" });

const blankLineInjector = new Writable({
  write(chunk, _encoding, callback) {
    const text = chunk.toString();
    fileStream.write(text);
    if (text.includes("→")) {
      fileStream.write("\n");
    }
    callback();
  },
});

const prettyStream = pretty({
  colorize: false,
  translateTime: "HH:MM:ss",
  ignore: "pid,hostname",
  singleLine: true,
  destination: blankLineInjector,
});

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",

    timestamp: () => {
      const now = new Date();

      const istTime = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      });

      return `,"timestamp":"${istTime}"`;
    },
  },
  prettyStream
);

export default logger;