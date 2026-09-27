import type { EmailExtraction } from "../schema.js";

// Helpers that compare a model output with a golden label. Used by the eval
// (3.6), never by the pipeline itself.

// True if both lists hold the same items, in any order. Duplicates count:
// ["A-10001", "A-10001"] does not equal ["A-10001"].
export function hasSameItems(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  // Sort copies, so the caller's arrays keep their order.
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((item, index) => item === sortedExpected[index]);
}

// The model reports each intent with a confidence; a label holds only the code
// value. Confidence is dropped, not used as a filter: every reported intent
// stays, whatever its confidence (see CLAUDE.md, Open experiments).
export function intentTypes(intents: EmailExtraction["intents"]) {
  return intents.map((intent) => intent.type);
}
