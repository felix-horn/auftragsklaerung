import { expect, test } from "vitest";
import { hasSameItems, intentTypes } from "./compare.js";

// All values below are invented. None is copied from the golden set.

test("same items, same order: equal", () => {
  expect(hasSameItems(["A-10001", "A-10002"], ["A-10001", "A-10002"])).toBe(true);
});

test("same items, different order: equal", () => {
  expect(hasSameItems(["purchase_inquiry", "complaint"], ["complaint", "purchase_inquiry"])).toBe(true);
});

test("both empty: equal", () => {
  expect(hasSameItems([], [])).toBe(true);
});

test("one item missing: not equal", () => {
  expect(hasSameItems(["A-10001"], ["A-10001", "A-10002"])).toBe(false);
});

test("one item extra: not equal", () => {
  expect(hasSameItems(["A-10001", "K-20001"], ["A-10001"])).toBe(false);
});

test("empty vs. one item: not equal", () => {
  expect(hasSameItems([], ["repeat_contact"])).toBe(false);
});

test("duplicate in the output: not equal", () => {
  expect(hasSameItems(["A-10001", "A-10001"], ["A-10001"])).toBe(false);
});

test("same length, same distinct items, different duplicates: not equal", () => {
  expect(hasSameItems(["complaint", "complaint", "other"], ["complaint", "other", "other"])).toBe(false);
});

test("identifiers are compared exactly: a lowercase prefix is a different number", () => {
  expect(hasSameItems(["a-10001"], ["A-10001"])).toBe(false);
});

test("the caller's arrays keep their order", () => {
  const actual = ["b", "a"];
  hasSameItems(actual, ["a", "b"]);
  expect(actual).toEqual(["b", "a"]);
});

test("intentTypes drops the confidence", () => {
  const types = intentTypes([
    { type: "complaint", confidence: 0.95 },
    { type: "purchase_inquiry", confidence: 0.7 },
  ]);
  expect(types).toEqual(["complaint", "purchase_inquiry"]);
});

test("intentTypes keeps a low-confidence intent: no 0.5 filter", () => {
  const types = intentTypes([
    { type: "cancellation", confidence: 0.9 },
    { type: "other", confidence: 0.3 },
  ]);
  expect(types).toEqual(["cancellation", "other"]);
});

test("intentTypes keeps a duplicate, so the comparison can fail on it", () => {
  const types = intentTypes([
    { type: "complaint", confidence: 0.9 },
    { type: "complaint", confidence: 0.6 },
  ]);
  expect(types).toEqual(["complaint", "complaint"]);
  expect(hasSameItems(types, ["complaint"])).toBe(false);
});