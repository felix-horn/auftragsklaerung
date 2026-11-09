import type { AssertionValueFunctionContext, GradingResult } from "promptfoo";
import {
  emailExtractionSchema,
  type EmailExtraction,
} from "../../src/schema.js";
import {
  goldenLabelsSchema,
  type GoldenLabels,
} from "../golden/case-schema.js";
import { hasSameItems, intentTypes } from "../golden/compare.js";
import { isDeadlineQuoteMatch } from "../golden/deadline.js";
import { deriveMessageUrgency } from "../../src/urgency.js";

// One assertion per labelled field.
// The config loads each one by name (file://assertions/fields.ts:intents)
// and gives it a metric of the same name,
// so promptfoo counts the results field by field.
// The comparison rules are in CLAUDE.md, section Eval comparison (Module 3.4).

type FieldCheck = (
  extraction: EmailExtraction,
  labels: GoldenLabels,
) => GradingResult;

// Turns a comparison of one field into a promptfoo assertion function.
// The two checks every field needs are done here, once.
function fieldAssertion(check: FieldCheck) {
  return (
    output: unknown,
    context: AssertionValueFunctionContext,
  ): GradingResult => {
    // 1. The labels arrive as test metadata (golden-tests.ts), which promptfoo
    //    types as `any`; safeParse checks them and gives back their type.
    //    Missing labels are a problem of the harness, not a result of the
    //    pipeline, so this throws and promptfoo reports an ERROR.
    const labels = goldenLabelsSchema.safeParse(context.test.metadata?.labels);
    if (!labels.success) {
      throw new Error(`${context.test.description}: no labels in metadata`);
    }

    // 2. A schema failure is a result of the pipeline: the output is then the
    //    model's raw text, and every field counts as wrong. This returns a
    //    failed result instead of throwing, because a throw would make the
    //    case an ERROR and remove it from every field's count.
    const extraction = emailExtractionSchema.safeParse(output);
    if (!extraction.success) {
      return { pass: false, score: 0, reason: "no valid extraction" };
    }

    return check(extraction.data, labels.data);
  };
}

// Score 1 for a match, 0 for a miss. The reason shows both sides, so the
// web view explains every result without opening the output.
function graded(
  hasPassed: boolean,
  got: string,
  expected: string,
): GradingResult {
  return {
    pass: hasPassed,
    score: hasPassed ? 1 : 0,
    reason: `got ${got}, expected ${expected}`,
  };
}

// Quotes strings and keeps brackets and null, so the reason shows the value
// exactly as the model returned it.
const show = (value: unknown) => JSON.stringify(value);

function sameItems(got: readonly string[], expected: readonly string[]) {
  return graded(hasSameItems(got, expected), show(got), show(expected));
}

export const intents = fieldAssertion((extraction, labels) =>
  sameItems(intentTypes(extraction.intents), labels.intents),
);

// Only present vs. null is compared, not the wording.
export const requestedAction = fieldAssertion((extraction, labels) => {
  const got = extraction.requestedAction;
  const expected = labels.requestedAction;
  const hasPassed = (got === null) === (expected === null);
  return graded(hasPassed, show(got), expected === null ? "null" : "an action");
});

export const orderNumbers = fieldAssertion((extraction, labels) =>
  sameItems(extraction.orderNumbers, labels.orderNumbers),
);

export const customerNumbers = fieldAssertion((extraction, labels) =>
  sameItems(extraction.customerNumbers, labels.customerNumbers),
);

export const escalationSignals = fieldAssertion((extraction, labels) =>
  sameItems(extraction.escalationSignals, labels.escalationSignals),
);

// Presence first, because a missed or invented deadline changes urgency
// (R-13); the wording is compared only when both sides have a deadline.
function deadlineMatches(got: string | null, expected: string | null) {
  if (got === null && expected === null) return true; // neither has one
  if (got === null || expected === null) return false; // missed or invented
  return isDeadlineQuoteMatch(got, expected);
}

export const deadlineStated = fieldAssertion((extraction, labels) => {
  const got = extraction.deadlineStated;
  const expected = labels.deadlineStated;
  return graded(deadlineMatches(got, expected), show(got), show(expected));
});

// Urgency is not a model field: the pipeline derives it from escalation
// signals and deadline, so this measures what the queue would show.
export const urgency = fieldAssertion((extraction, labels) => {
  const got = deriveMessageUrgency(extraction);
  return graded(got === labels.urgency, show(got), show(labels.urgency));
});
