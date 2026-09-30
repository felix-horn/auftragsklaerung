import { z } from "zod";
import type { GradingResult } from "promptfoo";
import { emailExtractionSchema } from "../../src/schema.js";

// Fails every case in which the pipeline produced no valid extraction.
// A successful extractEmail call has already passed this schema,
// so its output always passes here.
// After a failed call the provider passes on the model's raw text instead,
// and that fails.
export default function schemaValid(output: unknown): GradingResult {
  const result = emailExtractionSchema.safeParse(output);
  if (result.success) {
    return { pass: true, score: 1, reason: "schema-valid" };
  }
  return { pass: false, score: 0, reason: z.prettifyError(result.error) };
}
