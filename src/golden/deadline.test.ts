import { expect, test } from "vitest";
import { goldenCases } from "./cases.js";
import { deadlineQuoteMatches, normaliseDeadline } from "./deadline.js";

// Part 1: invented values, none copied from the golden set.

test("normalising: lower case, single spaces, no final punctuation", () => {
  expect(normaliseDeadline("  Spätestens   am\n12.06.  ")).toBe(
    "spätestens am 12.06",
  );
  expect(normaliseDeadline("By end of next week!")).toBe("by end of next week");
});

test("normalising keeps punctuation that is not at the very end", () => {
  expect(normaliseDeadline("am 12.06., 12 Uhr")).toBe("am 12.06., 12 uhr");
});

test("matches: identical", () => {
  expect(
    deadlineQuoteMatches("spätestens am 12.06.", "spätestens am 12.06."),
  ).toBe(true);
});

test("matches: capital letter and final full stop", () => {
  expect(
    deadlineQuoteMatches(
      "Innerhalb von drei Werktagen.",
      "innerhalb von drei Werktagen",
    ),
  ).toBe(true);
});

test("matches: date's final dot missing in the quote", () => {
  expect(
    deadlineQuoteMatches("spätestens am 12.06", "spätestens am 12.06."),
  ).toBe(true);
});

test("matches: whole sentence quoted instead of the time expression", () => {
  expect(
    deadlineQuoteMatches(
      "Bitte klären Sie das innerhalb von drei Werktagen.",
      "innerhalb von drei Werktagen",
    ),
  ).toBe(true);
});

test("no match: different date", () => {
  expect(
    deadlineQuoteMatches("spätestens am 13.06.", "spätestens am 12.06."),
  ).toBe(false);
});

test("no match: different span", () => {
  expect(
    deadlineQuoteMatches(
      "innerhalb von zwei Werktagen",
      "innerhalb von drei Werktagen",
    ),
  ).toBe(false);
});

test("no match: quote shorter than the label", () => {
  expect(deadlineQuoteMatches("12.06.", "spätestens am 12.06.")).toBe(false);
});

test("no match: translated instead of quoted (R-02)", () => {
  expect(
    deadlineQuoteMatches(
      "within three working days",
      "innerhalb von drei Werktagen",
    ),
  ).toBe(false);
});

test("known limit: added words are accepted, even when they change the meaning", () => {
  expect(deadlineQuoteMatches("bis Montag nächster Woche", "bis Montag")).toBe(
    true,
  );
});

// Part 2: the golden deadlines, imported from cases.ts and varied in code.

const goldenDeadlines: { id: string; email: string; label: string }[] = [];
for (const c of goldenCases) {
  if (c.labels === null || c.labels.deadlineStated === null) continue;
  goldenDeadlines.push({
    id: c.id,
    email: c.email,
    label: c.labels.deadlineStated,
  });
}

test("the golden set has deadlines to test with", () => {
  expect(goldenDeadlines.length).toBeGreaterThan(0);
});

for (const { id, email, label } of goldenDeadlines) {
  test(`${id}: label matches itself, varied, and inside the whole email`, () => {
    expect(deadlineQuoteMatches(label, label)).toBe(true);
    expect(deadlineQuoteMatches(`${label}.`, label)).toBe(true);
    expect(deadlineQuoteMatches(label.toUpperCase(), label)).toBe(true);
    expect(
      deadlineQuoteMatches(` ${label.replaceAll(" ", "  ")} `, label),
    ).toBe(true);
    expect(deadlineQuoteMatches(email, label)).toBe(true);
  });
}

test("no golden deadline matches another one", () => {
  for (const a of goldenDeadlines) {
    for (const b of goldenDeadlines) {
      if (a.id === b.id) continue;
      expect(deadlineQuoteMatches(a.label, b.label), `${a.id} vs ${b.id}`).toBe(
        false,
      );
    }
  }
});
