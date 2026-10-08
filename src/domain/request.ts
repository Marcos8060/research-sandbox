import { z } from "zod";
import { LIMITS } from "./brief.js";

/**
 * Turns whatever a person types into a bare domain:
 * "https://www.Notion.so/about" → "notion.so". Returns the input unchanged
 * (lower-cased) when there's nothing to strip, so validation can reject it.
 */
export function normalizeDomainInput(raw: string): string {
  const withoutProtocol = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  const host = withoutProtocol.split(/[/?#]/)[0] ?? "";
  return host.replace(/^www\./, "");
}

const domainInputSchema = z
  .string()
  .transform(normalizeDomainInput)
  .pipe(z.string().regex(z.regexes.domain, 'must be a domain like "notion.so"'));

/** What a caller (CLI, API, frontend) sends to request a brief. */
export const researchRequestSchema = z.object({
  customerName: z.string().trim().min(1, "customerName is required").max(LIMITS.customerName),
  // An empty box in a form arrives as "" — treat that as "not provided".
  domain: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    domainInputSchema.optional(),
  ),
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
