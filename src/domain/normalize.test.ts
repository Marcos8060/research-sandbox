import { describe, expect, it } from "vitest";
import {
  mergeSources,
  normalizeEmployeeRange,
  normalizeFirmographics,
  normalizeSignals,
  normalizeUrl,
} from "./normalize.js";
import type { SignalDraft } from "./research.js";

describe("normalizeUrl", () => {
  it("drops the #fragment and keeps the rest", () => {
    expect(normalizeUrl("https://acme.com/a?b=1#section")).toBe("https://acme.com/a?b=1");
  });

  it.each(["Reuters", "ftp://acme.com", "http://localhost:3000", ""])("rejects %s", (raw) => {
    expect(normalizeUrl(raw)).toBeNull();
  });
});

describe("mergeSources", () => {
  it("merges, de-duplicates and keeps first-seen order", () => {
    const result = mergeSources(
      ["https://a.com/1", "https://b.com/2#x"],
      ["https://b.com/2", "https://c.com/3"],
    );
    expect(result.value).toEqual(["https://a.com/1", "https://b.com/2", "https://c.com/3"]);
    expect(result.warnings).toEqual([]);
  });

  it("drops invalid entries with a warning", () => {
    const result = mergeSources(["https://a.com", "LinkedIn"]);
    expect(result.value).toEqual(["https://a.com/"]);
    expect(result.warnings[0]?.code).toBe("source_dropped");
  });
});

describe("normalizeEmployeeRange", () => {
  it("passes a clean range through untouched", () => {
    expect(normalizeEmployeeRange("50-200")).toEqual({ value: "50-200", warnings: [] });
  });

  it("tidies dashes and spaces silently", () => {
    expect(normalizeEmployeeRange("50 – 200").value).toBe("50-200");
  });

  it("salvages the range from v1's paragraph and records a repair", () => {
    const result = normalizeEmployeeRange(
      "308-1,000 (Wikipedia and PitchBook report 308 as of August 2024; LinkedIn reports 201-500)",
    );
    expect(result.value).toBe("308-1,000");
    expect(result.warnings[0]?.code).toBe("field_repaired");
  });

  it("drops text with no usable number", () => {
    const result = normalizeEmployeeRange("several hundred");
    expect(result.value).toBeUndefined();
    expect(result.warnings[0]?.code).toBe("field_dropped");
  });

  it("treats missing as missing, not as an error", () => {
    expect(normalizeEmployeeRange(undefined)).toEqual({ value: undefined, warnings: [] });
  });
});

describe("normalizeFirmographics", () => {
  it("cleans fields and returns the sources separately", () => {
    const result = normalizeFirmographics({
      industry: "  Fintech ",
      employeeCountEstimate: "201-500",
      headquarters: "",
      techStackHighlights: ["React", "React", " Go "],
      sourcesUsed: ["https://acme.com/about"],
    });
    expect(result.value.firmographics).toEqual({
      industry: "Fintech",
      employeeCountEstimate: "201-500",
      techStackHighlights: ["React", "Go"],
    });
    expect(result.value.sources).toEqual(["https://acme.com/about"]);
  });

  it("returns null firmographics (with a warning) when industry is empty", () => {
    const result = normalizeFirmographics({ industry: " ", sourcesUsed: [] });
    expect(result.value.firmographics).toBeNull();
    expect(result.warnings.some((w) => w.code === "field_dropped")).toBe(true);
  });
});

describe("normalizeSignals", () => {
  const good: SignalDraft = {
    date: "2026-09-01",
    headline: "Acme raises $50M",
    source: "Reuters",
    sourceUrl: "https://reuters.com/acme",
    relevance: "high",
  };

  it("keeps good signals, drops bad ones with reasons, and never loses the good ones", () => {
    const result = normalizeSignals([
      good,
      { ...good, sourceUrl: "Reuters", headline: "No link" },
      { ...good, date: "last week", headline: "Bad date", sourceUrl: "https://x.com/1" },
    ]);
    expect(result.value).toHaveLength(1);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.every((w) => w.code === "signal_dropped")).toBe(true);
  });

  it("accepts full timestamps by keeping the date part", () => {
    const result = normalizeSignals([{ ...good, date: "2026-09-01T08:30:00Z" }]);
    expect(result.value[0]?.date).toBe("2026-09-01");
  });

  it("sorts newest first and removes duplicate articles", () => {
    const result = normalizeSignals([
      { ...good, date: "2026-01-10", sourceUrl: "https://a.com/old" },
      { ...good, date: "2026-09-01", sourceUrl: "https://a.com/new" },
      { ...good, date: "2026-09-01", sourceUrl: "https://a.com/new#dup" },
    ]);
    expect(result.value.map((s) => s.date)).toEqual(["2026-09-01", "2026-01-10"]);
  });
});
