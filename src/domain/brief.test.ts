import { describe, expect, it } from "vitest";
import {
  type CustomerBrief,
  customerBriefSchema,
  employeeRangeSchema,
  firmographicsSchema,
  signalSchema,
} from "./brief.js";
import { firmographicsDraftSchema, signalDraftSchema } from "./research.js";

const reutersUrl = "https://www.reuters.com/technology/acme-raises-50m-2026-09-01/";

function validBrief(): CustomerBrief {
  return {
    customerName: "Acme",
    domain: "acme.com",
    firmographics: { industry: "B2B SaaS", employeeCountEstimate: "50-200" },
    recentSignals: [
      {
        date: "2026-09-01",
        headline: "Acme raises $50M Series B",
        source: "Reuters",
        sourceUrl: reutersUrl,
        relevance: "high",
      },
    ],
    synthesis: { summary: "Acme just raised a Series B and is scaling its sales team." },
    sourcesUsed: ["https://acme.com/about", reutersUrl],
    warnings: [],
  };
}

describe("employeeRangeSchema", () => {
  it.each(["50-200", "1,001-5,000", "10,000+", "1200", "1,200"])("accepts %s", (value) => {
    expect(employeeRangeSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    "308-1,000 (Wikipedia and PitchBook report 308 as of August 2024)", // the v1 bug
    "about 300",
    "50 to 200",
    "",
    "500-50", // backwards range
  ])("rejects %s", (value) => {
    expect(employeeRangeSchema.safeParse(value).success).toBe(false);
  });
});

describe("signalSchema", () => {
  const signal = validBrief().recentSignals[0];

  it("requires a sourceUrl (the v1 gap)", () => {
    const { sourceUrl: _omit, ...withoutUrl } = signal as NonNullable<typeof signal>;
    expect(signalSchema.safeParse(withoutUrl).success).toBe(false);
  });

  it("rejects impossible dates and non-ISO dates", () => {
    expect(signalSchema.safeParse({ ...signal, date: "2026-02-30" }).success).toBe(false);
    expect(signalSchema.safeParse({ ...signal, date: "March 2026" }).success).toBe(false);
  });

  it("rejects non-public URLs", () => {
    expect(signalSchema.safeParse({ ...signal, sourceUrl: "http://localhost/x" }).success).toBe(
      false,
    );
    expect(signalSchema.safeParse({ ...signal, sourceUrl: "Reuters" }).success).toBe(false);
  });
});

describe("customerBriefSchema", () => {
  it("accepts a valid brief", () => {
    expect(customerBriefSchema.safeParse(validBrief()).success).toBe(true);
  });

  it("rejects a signal whose URL is not in sourcesUsed (v1 bug)", () => {
    const brief = { ...validBrief(), sourcesUsed: ["https://acme.com/about"] };
    const result = customerBriefSchema.safeParse(brief);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["recentSignals", 0, "sourceUrl"]);
  });

  it("accepts a partial brief with firmographics null", () => {
    expect(customerBriefSchema.safeParse({ ...validBrief(), firmographics: null }).success).toBe(
      true,
    );
  });

  it("rejects a brief with no research at all", () => {
    const brief = { ...validBrief(), firmographics: null, recentSignals: [] };
    expect(customerBriefSchema.safeParse(brief).success).toBe(false);
  });

  it("rejects a brief with no sources", () => {
    const brief = { ...validBrief(), recentSignals: [], sourcesUsed: [] };
    expect(customerBriefSchema.safeParse(brief).success).toBe(false);
  });
});

describe("draft schemas stay in sync with the domain", () => {
  // If someone adds a field to the domain but forgets the agent draft (or the
  // other way round), this fails — the drift v1 had between its two copies.
  it("signal draft has exactly the domain signal fields", () => {
    expect(Object.keys(signalDraftSchema.shape).sort()).toEqual(
      Object.keys(signalSchema.shape).sort(),
    );
  });

  it("firmographics draft = domain fields + sourcesUsed", () => {
    expect(Object.keys(firmographicsDraftSchema.shape).sort()).toEqual(
      [...Object.keys(firmographicsSchema.shape), "sourcesUsed"].sort(),
    );
  });
});
