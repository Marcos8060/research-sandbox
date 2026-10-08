import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-", "must start with sk-ant-"),
  TAVILY_API_KEY: z.string().startsWith("tvly-", "must start with tvly-"),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
