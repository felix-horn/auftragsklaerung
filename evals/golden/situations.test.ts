import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { situations } from "./situations.js";

// Each situation ends with the rule that decides it, in brackets: "(R-09, …)"
// or "(Begriffe)". The rule must be a heading in POLICY.md, and the list must
// follow POLICY.md's order, so a typo in a rule ID, or a situation out of its
// rule's place, fails here.
const policy = readFileSync(
  new URL("../../docs/POLICY.md", import.meta.url),
  "utf8",
);

const ruleOf = (situation: string) =>
  situation.match(/\((R-\d{2}|Begriffe)(?:, [^)]+)?\)$/)?.[1];

const headingOf = (rule: string) =>
  rule === "Begriffe" ? "\n## Begriffe\n" : `\n### ${rule} — `;

test("every situation names its rule in brackets at the end", () => {
  const withoutRule = situations.filter((situation) => !ruleOf(situation));
  expect(withoutRule).toEqual([]);
});

test("every rule named is a heading in POLICY.md", () => {
  const unknown = situations
    .map((situation) => ruleOf(situation) ?? "")
    .filter((rule) => !policy.includes(headingOf(rule)));
  expect(unknown).toEqual([]);
});

test("only the Begriffe and R-01 to R-13, not the ERP stage's rules", () => {
  const ruleNumbers = situations
    .map((situation) => ruleOf(situation))
    .filter((rule) => rule !== "Begriffe")
    .map((rule) => Number(rule?.slice(2)));
  expect(ruleNumbers.every((number) => number >= 1 && number <= 13)).toBe(true);
});

test("the situations follow POLICY.md's order", () => {
  const positions = situations.map((situation) =>
    policy.indexOf(headingOf(ruleOf(situation) ?? "")),
  );
  const sorted = [...positions].sort((first, second) => first - second);
  expect(positions).toEqual(sorted);
});

test("no situation is listed twice", () => {
  expect(new Set(situations).size).toBe(situations.length);
});
