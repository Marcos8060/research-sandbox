import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.schema.js";

const valid = {
  ANTHROPIC_API_KEY: "sk-ant-test",
  TAVILY_API_KEY: "tvly-test",
  DATABASE_URL: "postgres://app:app@localhost:5433/research_agent",
};

describe("parseEnv", () => {
  it("accepts a valid environment and applies defaults", () => {
    const env = parseEnv(valid);
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.PORT).toBe(3001);
  });

  it("coerces PORT from a string", () => {
    expect(parseEnv({ ...valid, PORT: "8080" }).PORT).toBe(8080);
  });

  it("fails fast when a key is missing", () => {
    const { TAVILY_API_KEY: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/TAVILY_API_KEY/);
  });

  it("rejects a key with the wrong prefix", () => {
    expect(() => parseEnv({ ...valid, ANTHROPIC_API_KEY: "tvly-oops" })).toThrow(/sk-ant-/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://x@localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
