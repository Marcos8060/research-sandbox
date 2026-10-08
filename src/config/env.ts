import { parseEnv } from "./env.schema.js";

// Parsed once, at import time. If anything is missing or malformed the
// process crashes here, on startup, with a readable message — not 40 seconds
// into the first research job.
export const env = parseEnv(process.env);
