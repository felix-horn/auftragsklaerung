// Comparing the model's deadline with a golden label. Used by the eval (3.6),
// never by the pipeline itself.
//
// Presence (null vs. text) is checked separately, before this: a missed or
// invented deadline changes urgency (R-13), a differently quoted one does not.

// Tolerates what does not change the deadline: capital letters, spacing and
// punctuation at the very end. Applied to both sides, so stripping a date's
// final dot ("30.04." -> "30.04") happens on both and cancels out.
export function normaliseDeadline(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
}

// True if the label's wording occurs in the model's quote, after normalising.
// Containment, not equality: the model is told to quote verbatim, but not how
// much to quote. Known limit: extra words around the label are accepted.
export function deadlineQuoteMatches(
  actual: string,
  expected: string,
): boolean {
  return normaliseDeadline(actual).includes(normaliseDeadline(expected));
}
