import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "evals/**/*.test.ts"],
    environment: "node",
    // Tests run as NODE_ENV=test: JSON logs (no pretty transport) and,
    // from later phases, mocked search/LLM calls — never real API spend.
    env: { NODE_ENV: "test" },
  },
});
