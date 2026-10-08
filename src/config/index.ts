import { env } from "./env.js";

export const config = {
  env,
  isProd: env.NODE_ENV === "production",
  serviceName: "research-agent",
} as const;
