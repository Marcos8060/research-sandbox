import { pino } from "pino";
import { config } from "../config/index.js";

export const logger = pino({
  name: config.serviceName,
  level: config.env.LOG_LEVEL,
  // Never let a secret reach the logs, even if someone logs a whole object.
  redact: {
    paths: [
      "apiKey",
      "*.apiKey",
      "authorization",
      "*.authorization",
      "*.headers.authorization",
      "password",
      "*.password",
    ],
    censor: "[redacted]",
  },
  // Pretty, colourised output for humans in dev; raw JSON everywhere else so
  // log tooling (CloudWatch, Datadog, etc.) can parse it.
  ...(config.isProd || config.env.NODE_ENV === "test"
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true } } }),
});
