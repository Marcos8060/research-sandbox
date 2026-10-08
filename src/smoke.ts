import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";

logger.info({ nodeEnv: config.env.NODE_ENV, port: config.env.PORT }, "Config loaded and validated");
logger.info({ apiKey: config.env.ANTHROPIC_API_KEY }, "This key should appear as [redacted]");
