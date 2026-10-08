import { describe, expect, it } from "vitest";
import { normalizeDomainInput, researchRequestSchema } from "./request.js";

describe("normalizeDomainInput", () => {
  it.each([
    ["notion.so", "notion.so"],
    ["https://www.Notion.so/about?x=1", "notion.so"],
    ["  ANDELA.com/ ", "andela.com"],
    ["http://blog.acme.co.uk#top", "blog.acme.co.uk"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDomainInput(input)).toBe(expected);
  });
});

describe("researchRequestSchema", () => {
  it("trims the name and normalizes the domain", () => {
    expect(
      researchRequestSchema.parse({ customerName: "  Notion ", domain: "https://notion.so" }),
    ).toEqual({ customerName: "Notion", domain: "notion.so" });
  });

  it("treats an empty domain as not provided", () => {
    expect(researchRequestSchema.parse({ customerName: "Notion", domain: "" })).toEqual({
      customerName: "Notion",
    });
  });

  it("rejects a blank name and a junk domain", () => {
    expect(researchRequestSchema.safeParse({ customerName: "   " }).success).toBe(false);
    expect(
      researchRequestSchema.safeParse({ customerName: "Acme", domain: "not a domain" }).success,
    ).toBe(false);
  });
});
