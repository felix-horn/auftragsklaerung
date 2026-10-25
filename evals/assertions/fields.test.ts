import { expect, test } from "vitest";
import type { AssertionValueFunctionContext } from "promptfoo";
import type { EmailExtraction } from "../../src/schema.js";
import type { GoldenLabels } from "../golden/case-schema.js";
import { goldenCases } from "../golden/cases.js";
import * as fields from "./fields.js";

// The context promptfoo passes to an assertion. The field assertions read
// only test.metadata.labels; everything else stays empty.
function contextWith(labels: unknown): AssertionValueFunctionContext {
  return {
    prompt: undefined,
    vars: {},
    test: { metadata: { labels } },
    logProbs: undefined,
    provider: undefined,
    providerResponse: undefined,
  };
}

// The answer a model gives when it matches every label.
function answerMatching(labels: GoldenLabels): EmailExtraction {
  return {
    intents: labels.intents.map((type) => ({ type, confidence: 1 })),
    orderNumbers: labels.orderNumbers,
    customerNumbers: labels.customerNumbers,
    requestedAction: labels.requestedAction,
    deadlineStated: labels.deadlineStated,
    escalationSignals: labels.escalationSignals,
  };
}

// Invented labels with a deadline and an action.
const invented: GoldenLabels = {
  intents: ["order_status"],
  requestedAction: "Liefertermin mitteilen",
  orderNumbers: ["A-10001"],
  customerNumbers: [],
  escalationSignals: [],
  deadlineStated: "bis Montag",
  urgency: "medium",
};

// Catches a field compared with the wrong label.
for (const { id, labels } of goldenCases) {
  if (labels === null) continue;
  test(`${id}: an answer matching the labels passes every field`, () => {
    for (const [field, assertion] of Object.entries(fields)) {
      const result = assertion(answerMatching(labels), contextWith(labels));
      expect(result.pass, field).toBe(true);
    }
  });
}

test("raw text after a schema failure fails every field, no throw", () => {
  for (const [field, assertion] of Object.entries(fields)) {
    const result = assertion('{"intents": [', contextWith(invented));
    expect(result, field).toEqual({
      pass: false,
      score: 0,
      reason: "no valid extraction",
    });
  }
});

test("missing labels throw, so promptfoo reports an ERROR", () => {
  for (const assertion of Object.values(fields)) {
    expect(() =>
      assertion(answerMatching(invented), contextWith(undefined)),
    ).toThrow("no labels in metadata");
  }
});

test("a missed or invented deadline or action fails", () => {
  const { deadlineStated, requestedAction } = fields;
  const neither = { deadlineStated: null, requestedAction: null };
  const answerWithBoth = answerMatching(invented);
  const answerWithNeither = { ...answerWithBoth, ...neither };
  const expectsBoth = contextWith(invented);
  const expectsNeither = contextWith({ ...invented, ...neither });

  // Missed: the label has them, the answer does not.
  expect(deadlineStated(answerWithNeither, expectsBoth).pass).toBe(false);
  expect(requestedAction(answerWithNeither, expectsBoth).pass).toBe(false);
  // Invented: the answer has them, the label does not.
  expect(deadlineStated(answerWithBoth, expectsNeither).pass).toBe(false);
  expect(requestedAction(answerWithBoth, expectsNeither).pass).toBe(false);
});
