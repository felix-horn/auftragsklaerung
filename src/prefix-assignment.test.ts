import { expect, test } from "vitest";
import { goldenCases } from "../evals/golden/cases.js";
import { assignIdentifiersByPrefix } from "./prefix-assignment.js";

// Part 1: invented numbers, shaped like the examples in the rule on order
// and customer numbers (R-09). None is copied from
// the golden set.

test("Stufe 1: a K- number filed as an order number moves to customer numbers", () => {
  const result = assignIdentifiersByPrefix({
    orderNumbers: ["K-20001"],
    customerNumbers: [],
  });
  expect(result).toEqual({ orderNumbers: [], customerNumbers: ["K-20001"] });
});

test("Stufe 1: an A- number filed as a customer number moves to order numbers", () => {
  const result = assignIdentifiersByPrefix({
    orderNumbers: [],
    customerNumbers: ["A-10001"],
  });
  expect(result).toEqual({ orderNumbers: ["A-10001"], customerNumbers: [] });
});

test("correctly filed numbers stay where they are", () => {
  const result = assignIdentifiersByPrefix({
    orderNumbers: ["A-10001", "A-10002"],
    customerNumbers: ["K-20001"],
  });
  expect(result).toEqual({
    orderNumbers: ["A-10001", "A-10002"],
    customerNumbers: ["K-20001"],
  });
});

test("nothing in, nothing out", () => {
  expect(assignIdentifiersByPrefix({ orderNumbers: [], customerNumbers: [] })).toEqual({
    orderNumbers: [],
    customerNumbers: [],
  });
});

test("limit: a number without prefix stays in the list the model chose (Stufe 2)", () => {
  expect(
    assignIdentifiersByPrefix({ orderNumbers: [], customerNumbers: ["20417"] }),
  ).toEqual({ orderNumbers: [], customerNumbers: ["20417"] });
  expect(
    assignIdentifiersByPrefix({ orderNumbers: ["20417"], customerNumbers: [] }),
  ).toEqual({ orderNumbers: ["20417"], customerNumbers: [] });
});

test("limit: a number that belongs in neither list is not removed (Stufe 3)", () => {
  const result = assignIdentifiersByPrefix({
    orderNumbers: ["2024-1234"],
    customerNumbers: [],
  });
  expect(result).toEqual({ orderNumbers: ["2024-1234"], customerNumbers: [] });
});

test("only the exact R-09 format counts as a prefix", () => {
  const result = assignIdentifiersByPrefix({
    orderNumbers: ["K-2001", "K-200011", "k-20001"],
    customerNumbers: [],
  });
  expect(result).toEqual({
    orderNumbers: ["K-2001", "K-200011", "k-20001"],
    customerNumbers: [],
  });
});

test("the same number in both lists ends up twice: nothing is merged", () => {
  const result = assignIdentifiersByPrefix({
    orderNumbers: ["K-20001"],
    customerNumbers: ["K-20001"],
  });
  expect(result).toEqual({
    orderNumbers: [],
    customerNumbers: ["K-20001", "K-20001"],
  });
});

// Part 2: the golden labels already put every prefixed number where its
// prefix says (R-09), so the function must leave every one of them
// unchanged.

for (const goldenCase of goldenCases) {
  const labels = goldenCase.labels;
  if (labels === null) continue;

  test(`${goldenCase.id}: labelled numbers are already where their prefix says`, () => {
    expect(assignIdentifiersByPrefix(labels)).toEqual({
      orderNumbers: labels.orderNumbers,
      customerNumbers: labels.customerNumbers,
    });
  });
}
