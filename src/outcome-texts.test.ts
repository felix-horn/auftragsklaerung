import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { outcomeTexts } from "./outcome-texts.js";

// The texts belong to POLICY.md; the table only repeats them. Each must
// occur there word for word, inside „…“ as POLICY.md quotes them, so a
// typo, a missing full stop or a text reworded in POLICY.md fails here.
//
// POLICY.md wraps its lines, sometimes in the middle of a text: the
// unknown-sender text (R-14) is split as „Absender ist / keinem Kunden
// zugeordnet.“ In Markdown a line break inside a paragraph is a space, so
// every run of spaces and line breaks counts as one space.
const policy = readFileSync(
  new URL("../docs/POLICY.md", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

for (const [kind, text] of Object.entries(outcomeTexts)) {
  test(`${kind}: „${text}“ occurs in docs/POLICY.md`, () => {
    const isInPolicy = policy.includes(`„${text}“`);
    expect(isInPolicy, `„${text}“ is not in docs/POLICY.md`).toBe(true);
  });
}
