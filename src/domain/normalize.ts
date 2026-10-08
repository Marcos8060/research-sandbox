import {
  type BriefWarning,
  employeeRangeSchema,
  type Firmographics,
  firmographicsSchema,
  httpUrlSchema,
  LIMITS,
  type Signal,
  signalSchema,
} from "./brief.js";
import type { FirmographicsDraft, SignalDraft } from "./research.js";

// Every normalizer returns the cleaned value AND the warnings it produced,
// instead of throwing or silently "fixing" things. Nothing disappears without
// a record of why.
export interface Normalized<T> {
  value: T;
  warnings: BriefWarning[];
}

// ─── URLs ──────────────────────────────────────────────────────────────────

/**
 * Canonical form of a public http(s) URL, or null if it isn't one.
 * Drops the #fragment so "page#a" and "page#b" count as the same source.
 */
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  url.hash = "";
  const href = url.href;
  // Validate the canonical form with the same rule the brief uses.
  return httpUrlSchema.safeParse(href).success ? href : null;
}

/** Merge several URL lists into one, normalized and de-duplicated, order kept. */
export function mergeSources(...lists: ReadonlyArray<readonly string[]>): Normalized<string[]> {
  const seen = new Set<string>();
  const value: string[] = [];
  const warnings: BriefWarning[] = [];

  for (const raw of lists.flat()) {
    const url = normalizeUrl(raw);
    if (url === null) {
      warnings.push({ code: "source_dropped", message: `Not a valid public URL: "${raw}"` });
      continue;
    }
    if (!seen.has(url)) {
      seen.add(url);
      value.push(url);
    }
  }
  return { value, warnings };
}

// ─── Employee count ────────────────────────────────────────────────────────

/** Leading range at the start of a messy string: "308-1,000 (LinkedIn says…)" → "308-1,000". */
const LEADING_RANGE = /^\d[\d,]*(?:-\d[\d,]*|\+)?/;

function tidyRange(raw: string): string {
  return raw
    .trim()
    .replace(/[–—]/g, "-") // en/em dashes → hyphen
    .replace(/\s*-\s*/g, "-"); // "50 - 200" → "50-200"
}

export function normalizeEmployeeRange(raw: string | undefined): Normalized<string | undefined> {
  if (raw === undefined || raw.trim() === "") return { value: undefined, warnings: [] };

  const tidy = tidyRange(raw);
  if (employeeRangeSchema.safeParse(tidy).success) return { value: tidy, warnings: [] };

  // Salvage a leading range from a paragraph, but only if it's valid on its own.
  const salvaged = tidy.match(LEADING_RANGE)?.[0];
  if (salvaged && employeeRangeSchema.safeParse(salvaged).success) {
    return {
      value: salvaged,
      warnings: [
        {
          code: "field_repaired",
          message: `employeeCountEstimate trimmed from "${raw}" to "${salvaged}"`,
        },
      ],
    };
  }

  return {
    value: undefined,
    warnings: [{ code: "field_dropped", message: `employeeCountEstimate was unusable: "${raw}"` }],
  };
}

// ─── Firmographics ─────────────────────────────────────────────────────────

function optionalText(
  field: string,
  raw: string | undefined,
  max: number,
  warnings: BriefWarning[],
): string | undefined {
  const text = raw?.trim();
  if (!text) return undefined;
  if (text.length > max) {
    warnings.push({ code: "field_dropped", message: `${field} longer than ${max} characters` });
    return undefined;
  }
  return text;
}

/**
 * Draft → domain firmographics plus its source URLs. Returns firmographics
 * null when the one required field (industry) is unusable.
 */
export function normalizeFirmographics(
  draft: FirmographicsDraft,
): Normalized<{ firmographics: Firmographics | null; sources: string[] }> {
  const warnings: BriefWarning[] = [];

  const industry = optionalText("industry", draft.industry, LIMITS.industry, warnings);
  const employees = normalizeEmployeeRange(draft.employeeCountEstimate);
  warnings.push(...employees.warnings);

  const tech = [...new Set((draft.techStackHighlights ?? []).map((t) => t.trim()))]
    .filter((t) => t.length > 0 && t.length <= LIMITS.techItem)
    .slice(0, LIMITS.techItems);

  const sources = mergeSources(draft.sourcesUsed);
  warnings.push(...sources.warnings);

  if (industry === undefined) {
    warnings.push({ code: "field_dropped", message: "industry missing — firmographics discarded" });
    return { value: { firmographics: null, sources: sources.value }, warnings };
  }

  const candidate = {
    industry,
    employeeCountEstimate: employees.value,
    headquarters: optionalText("headquarters", draft.headquarters, LIMITS.headquarters, warnings),
    fundingStage: optionalText("fundingStage", draft.fundingStage, LIMITS.fundingStage, warnings),
    techStackHighlights: tech.length > 0 ? tech : undefined,
  };

  // Final gate: the result must satisfy the strict domain schema. If this
  // ever fails, a normalizer above has a bug — fail loudly, don't ship it.
  return {
    value: { firmographics: firmographicsSchema.parse(candidate), sources: sources.value },
    warnings,
  };
}

// ─── Signals ───────────────────────────────────────────────────────────────

/**
 * Draft signals → valid domain signals, newest first, capped at
 * LIMITS.maxSignals. Each invalid signal is dropped with a warning saying why;
 * one bad signal never costs us the good ones.
 */
export function normalizeSignals(drafts: readonly SignalDraft[]): Normalized<Signal[]> {
  const warnings: BriefWarning[] = [];
  const valid: Signal[] = [];
  const seenUrls = new Set<string>();

  for (const draft of drafts) {
    const candidate = {
      // Accept "2026-03-01T09:00:00Z" by keeping just the date part.
      date: draft.date.trim().slice(0, 10),
      headline: draft.headline.trim(),
      source: draft.source.trim(),
      sourceUrl: normalizeUrl(draft.sourceUrl) ?? draft.sourceUrl,
      relevance: draft.relevance,
    };

    const result = signalSchema.safeParse(candidate);
    if (!result.success) {
      const reasons = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      warnings.push({
        code: "signal_dropped",
        message: `Dropped "${candidate.headline}" — ${reasons}`,
      });
      continue;
    }
    if (seenUrls.has(result.data.sourceUrl)) continue; // same article reported twice
    seenUrls.add(result.data.sourceUrl);
    valid.push(result.data);
  }

  // ISO dates sort correctly as plain strings; newest first.
  valid.sort((a, b) => b.date.localeCompare(a.date));
  return { value: valid.slice(0, LIMITS.maxSignals), warnings };
}
