import { expect, test } from "vitest";
import { goldenCases } from "./golden/cases.js";
import { deriveUrgency } from "./urgency.js";

// Every labelled golden case: the labelled signals and deadline must give the
// labelled urgency. Labels are read from cases.ts, never copied into this file.
for (const goldenCase of goldenCases) {
  const {labels} = goldenCase;
  if (labels === null) continue; // not yet labelled: nothing to compare

  test(`${goldenCase.id}: urgency from labelled signals and deadline`, () => {
    expect(deriveUrgency(labels)).toBe(labels.urgency);
  });
}

// R-13: "Eine wiederholte Kontaktaufnahme mit Frist bleibt mittel."
// No golden case has exactly this combination. Invented input, not from the golden set.
test("R-13: repeated contact with a deadline stays medium", () => {
  const urgency = deriveUrgency({
    escalationSignals: ["repeat_contact"],
    deadlineStated: "spätestens am 12.06.",
  });
  expect(urgency).toBe("medium");
});
