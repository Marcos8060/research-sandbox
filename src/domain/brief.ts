import { z } from "zod";

export const LIMITS = {
  customerName: 120,
  industry: 80,
  employeeCount: 25,
  headquarters: 100,
  fundingStage: 60,
  techItem: 40,
  techItems: 10,
  headline: 200,
  sourceName: 80,
  maxSignals: 8,
  summary: 600,
  suggestedTiming: 200,
} as const;

export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
  error: "must be a public http(s) URL",
});

export const isoDateSchema = z.iso.date({ error: "must be a real date in YYYY-MM-DD form" });

export const RELEVANCE_LEVELS = ["high", "medium", "low"] as const;
export const relevanceSchema = z.enum(RELEVANCE_LEVELS);
export const EMPLOYEE_RANGE_PATTERN =
  /^[1-9](?:\d{0,2}(?:,\d{3})+|\d*)(?:-[1-9](?:\d{0,2}(?:,\d{3})+|\d*)|\+)?$/;

function parseCount(part: string): number {
  return Number(part.replaceAll(",", ""));
}

export const employeeRangeSchema = z
  .string()
  .max(LIMITS.employeeCount)
  .regex(EMPLOYEE_RANGE_PATTERN, 'must look like "50-200", "10,000+" or "1200"')
  .refine((value) => {
    const [low, high] = value.replace("+", "").split("-");
    return high === undefined || parseCount(low ?? "") <= parseCount(high);
  }, "range must go from low to high");

// ─── Firmographics ─────────────────────────────────────────────────────────

export const firmographicsSchema = z.object({
  industry: z.string().min(1).max(LIMITS.industry),
  // Optional on purpose: if sources don't give a usable headcount we leave it
  // out rather than invent one. Missing is honest; made-up is not.
  employeeCountEstimate: employeeRangeSchema.optional(),
  headquarters: z.string().min(1).max(LIMITS.headquarters).optional(),
  fundingStage: z.string().min(1).max(LIMITS.fundingStage).optional(),
  techStackHighlights: z
    .array(z.string().min(1).max(LIMITS.techItem))
    .max(LIMITS.techItems)
    .optional(),
});

// ─── Signals ───────────────────────────────────────────────────────────────

export const signalSchema = z.object({
  date: isoDateSchema,
  headline: z.string().min(1).max(LIMITS.headline),
  source: z.string().min(1).max(LIMITS.sourceName), // publication name, e.g. "Reuters"
  sourceUrl: httpUrlSchema, // REQUIRED — the v1 gap: every signal must be clickable
  relevance: relevanceSchema,
});

// ─── Synthesis ─────────────────────────────────────────────────────────────

export const synthesisSchema = z.object({
  summary: z.string().min(1).max(LIMITS.summary),
  suggestedTiming: z.string().min(1).max(LIMITS.suggestedTiming).optional(),
});

// ─── Warnings ──────────────────────────────────────────────────────────────
// Typed codes (not free text) so the evaluator, API and frontend can react to
// them programmatically — e.g. show a "partial brief" badge.

export const WARNING_CODES = [
  "research_step_failed", // one research agent failed; brief is partial
  "field_dropped", // a firmographics field was invalid and removed
  "field_repaired", // a field was salvaged, e.g. employee count trimmed
  "signal_dropped", // a signal failed validation (bad date, missing URL...)
  "source_dropped", // a source string wasn't a valid public URL
  "ungrounded_date", // synthesis mentions a date not in the research data
  "ungrounded_name", // synthesis mentions a proper noun not in the data
] as const;

export const warningSchema = z.object({
  code: z.enum(WARNING_CODES),
  message: z.string().min(1),
});

// ─── The brief ─────────────────────────────────────────────────────────────

export const customerBriefSchema = z
  .object({
    customerName: z.string().trim().min(1).max(LIMITS.customerName),
    domain: z.string().regex(z.regexes.domain).optional(),
    // null = the firmographics step failed; the brief is still useful if
    // signals succeeded (v1 threw the whole brief away in that case).
    firmographics: firmographicsSchema.nullable(),
    recentSignals: z.array(signalSchema).max(LIMITS.maxSignals),
    synthesis: synthesisSchema,
    sourcesUsed: z.array(httpUrlSchema).min(1, "a brief with no sources cannot be verified"),
    warnings: z.array(warningSchema),
  })
  .superRefine((brief, ctx) => {
    // Invariant 1 — the trust mechanism: every signal's URL must appear in
    // sourcesUsed. v1 broke exactly this; now it cannot happen silently.
    const sources = new Set(brief.sourcesUsed);
    brief.recentSignals.forEach((signal, index) => {
      if (!sources.has(signal.sourceUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["recentSignals", index, "sourceUrl"],
          message: "signal sourceUrl is missing from sourcesUsed",
        });
      }
    });

    // Invariant 2 — a brief must contain *some* research.
    if (brief.firmographics === null && brief.recentSignals.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["firmographics"],
        message: "brief has neither firmographics nor signals",
      });
    }
  });

// ─── Types ─────────────────────────────────────────────────────────────────
// Derived from the schemas, never written by hand, so they cannot drift.

export type Relevance = z.infer<typeof relevanceSchema>;
export type Firmographics = z.infer<typeof firmographicsSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Synthesis = z.infer<typeof synthesisSchema>;
export type BriefWarning = z.infer<typeof warningSchema>;
export type WarningCode = BriefWarning["code"];
export type CustomerBrief = z.infer<typeof customerBriefSchema>;
