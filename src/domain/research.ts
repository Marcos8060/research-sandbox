import { z } from "zod";
import { LIMITS, relevanceSchema } from "./brief.js";

// What we ASK the research agents to return ("drafts").
//
// These are deliberately looser than the domain schemas in brief.ts. The AI
// SDK validates model output against the whole schema: if a single signal had
// a malformed date, a strict schema would reject the ENTIRE response and we'd
// lose every good signal with it. So agents return drafts, and normalize.ts
// keeps the valid parts, drops or repairs the rest, and records a warning for
// each change. The .describe() text is sent to the model as instructions.

export const firmographicsDraftSchema = z.object({
  industry: z
    .string()
    .describe(
      `The company's primary industry in a few words, e.g. "B2B SaaS — productivity software". Max ${LIMITS.industry} characters.`,
    ),
  employeeCountEstimate: z
    .string()
    .optional()
    .describe(
      'Headcount as a short numeric range ONLY: "50-200", "1,001-5,000" or "10,000+". No words, years, sources or brackets. If sources disagree, give a range covering them. Omit if unknown.',
    ),
  headquarters: z.string().optional().describe('City and country, e.g. "San Francisco, USA".'),
  fundingStage: z
    .string()
    .optional()
    .describe('e.g. "Series C", "Public (NYSE: XYZ)", "Bootstrapped". Omit if unknown.'),
  techStackHighlights: z
    .array(z.string())
    .optional()
    .describe(
      `Up to ${LIMITS.techItems} notable technologies the company uses, one short name per item.`,
    ),
  sourcesUsed: z
    .array(z.string())
    .describe(
      "Full https:// URLs of every page you used. Citations belong here and NOWHERE else — never inside other fields.",
    ),
});

export const signalDraftSchema = z.object({
  date: z.string().describe("Publication date of the source article, as YYYY-MM-DD."),
  headline: z.string().describe(`One-line factual headline, max ${LIMITS.headline} characters.`),
  source: z.string().describe('Publication name, e.g. "Reuters" or "TechCrunch".'),
  sourceUrl: z.string().describe("The full https:// URL of the article this signal came from."),
  relevance: relevanceSchema.describe(
    'Sales/customer-success relevance: funding or leadership change = "high", hiring/product launch = "medium", routine PR = "low".',
  ),
});

export const signalsDraftSchema = z.object({
  recentSignals: z.array(signalDraftSchema),
});

export type FirmographicsDraft = z.infer<typeof firmographicsDraftSchema>;
export type SignalDraft = z.infer<typeof signalDraftSchema>;
export type SignalsDraft = z.infer<typeof signalsDraftSchema>;
