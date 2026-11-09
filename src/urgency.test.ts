import { expect, test } from "vitest";
import { goldenCases } from "../evals/golden/cases.js";
import type { Order } from "./erp-contract.js";
import type { ErpStageResult, OrderOutcome } from "./erp-stage.js";
import type { EmailExtraction } from "./schema.js";
import {
  deriveMessageUrgency,
  deriveUrgencyAfterLookup,
  isPromiseOverdue,
} from "./urgency.js";

// Every labelled golden case: the labelled signals and deadline must give the
// labelled urgency. Labels are read from cases.ts, never copied into this file.
for (const goldenCase of goldenCases) {
  const {labels} = goldenCase;
  if (labels === null) continue; // not yet labelled: nothing to compare

  test(`${goldenCase.id}: urgency from labelled signals and deadline`, () => {
    expect(deriveMessageUrgency(labels)).toBe(labels.urgency);
  });
}

// An example in the urgency rule (R-13): "Eine wiederholte
// Kontaktaufnahme mit Frist bleibt mittel."
// No golden case has exactly this combination. Invented input, not from the golden set.
test("R-13: repeated contact with a deadline stays medium", () => {
  const urgency = deriveMessageUrgency({
    escalationSignals: ["repeat_contact"],
    deadlineStated: "spätestens am 12.06.",
  });
  expect(urgency).toBe("medium");
});

// The urgency after the lookup (R-17). Invented records, as in
// src/erp-stage.test.ts (customer K-20001, orders A-10001 to A-10003).
// None is copied from the golden set, from POLICY.md or from
// mock-erp/data.json. No server, no API call.

// Promised for 2026-11-10, not shipped yet. Each test changes what it needs.
const orderInProgress: Order = {
  orderNumber: "A-10001",
  customerNumber: "K-20001",
  status: "in_progress",
  promisedDeliveryDate: "2026-11-10",
  shippedOn: null,
};

const shippedOrder: Order = {
  ...orderInProgress,
  orderNumber: "A-10002",
  status: "shipped",
  shippedOn: "2026-11-04",
};

const deliveredOrder: Order = {
  ...shippedOrder,
  orderNumber: "A-10003",
  status: "delivered",
};

const BEFORE_PROMISE = "2026-11-09";
const PROMISED_DAY = "2026-11-10";
const AFTER_PROMISE = "2026-11-11";

const cancellation: EmailExtraction["intents"] = [
  { type: "cancellation", confidence: 0.95 },
];
const orderStatusQuestion: EmailExtraction["intents"] = [
  { type: "order_status", confidence: 0.95 },
];

// The ERP stage's result for a sender of K-20001, one lookup per outcome.
// A lookup with order data carries that order's number; the others get
// invented numbers A-19901, A-19902, …
function assignedWith(...outcomes: OrderOutcome[]): ErpStageResult {
  return {
    kind: "assigned",
    customerNumber: "K-20001",
    orders: outcomes.map((outcome, index) => ({
      extractedOrderNumber:
        outcome.kind === "order"
          ? outcome.order.orderNumber
          : `A-1990${index + 1}`,
      outcome,
    })),
  };
}

function withData(order: Order): OrderOutcome {
  return { kind: "order", order };
}

// An overdue promise (R-17): the date boundary

test("R-17: a promise is overdue from the day after the promised date", () => {
  expect(isPromiseOverdue(orderInProgress, AFTER_PROMISE)).toBe(true);
  expect(isPromiseOverdue(orderInProgress, "2026-12-01")).toBe(true);
});

test("R-17 (v1.9): on the promised day itself the promise is not overdue", () => {
  expect(isPromiseOverdue(orderInProgress, PROMISED_DAY)).toBe(false);
});

test("R-17: before the promised date the promise is not overdue", () => {
  expect(isPromiseOverdue(orderInProgress, BEFORE_PROMISE)).toBe(false);
});

test("R-17: the dates compare across a month and a year end", () => {
  const promisedOnOctober31 = {
    ...orderInProgress,
    promisedDeliveryDate: "2026-10-31",
  };
  expect(isPromiseOverdue(promisedOnOctober31, "2026-11-01")).toBe(true);
  const promisedOnDecember31 = {
    ...orderInProgress,
    promisedDeliveryDate: "2026-12-31",
  };
  expect(isPromiseOverdue(promisedOnDecember31, "2027-01-01")).toBe(true);
  expect(isPromiseOverdue(promisedOnDecember31, "2026-12-31")).toBe(false);
});

test("R-17: a shipped order is not delivered: its passed promise is overdue", () => {
  expect(isPromiseOverdue(shippedOrder, AFTER_PROMISE)).toBe(true);
});

test("R-17: a delivered order's passed promise is not overdue", () => {
  expect(isPromiseOverdue(deliveredOrder, AFTER_PROMISE)).toBe(false);
});

test("R-17: an order without a promised date has no overdue promise", () => {
  const withoutPromise = { ...orderInProgress, promisedDeliveryDate: null };
  expect(isPromiseOverdue(withoutPromise, AFTER_PROMISE)).toBe(false);
});

// The urgency after the lookup, the whole rule (R-17)

test("R-17: an overdue promise raises low to medium", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: orderStatusQuestion,
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: AFTER_PROMISE,
    }),
  ).toBe("medium");
});

test("R-17 (v1.9): the same order on its promised day stays low", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: orderStatusQuestion,
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: PROMISED_DAY,
    }),
  ).toBe("low");
});

test("R-17: a cancellation of an order in progress raises low to medium", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: cancellation,
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: BEFORE_PROMISE,
    }),
  ).toBe("medium");
});

test("R-17: a cancellation alongside another intent counts as a cancellation", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: [
        { type: "cancellation", confidence: 0.9 },
        { type: "document_request", confidence: 0.85 },
      ],
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: BEFORE_PROMISE,
    }),
  ).toBe("medium");
});

test("R-17: a cancellation of a shipped or delivered order raises nothing", () => {
  for (const order of [shippedOrder, deliveredOrder]) {
    expect(
      deriveUrgencyAfterLookup({
        messageUrgency: "low",
        intents: cancellation,
        erpStageResult: assignedWith(withData(order)),
        lookupDate: BEFORE_PROMISE,
      }),
    ).toBe("low");
  }
});

test("R-17: an order in progress without a cancellation or a passed promise raises nothing", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: orderStatusQuestion,
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: BEFORE_PROMISE,
    }),
  ).toBe("low");
});

test("R-17 (v1.9): the status decides whether an order is shipped, not shippedOn", () => {
  const inProgressWithShippingDate = {
    ...orderInProgress,
    shippedOn: "2026-11-04",
  };
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: cancellation,
      erpStageResult: assignedWith(withData(inProgressWithShippingDate)),
      lookupDate: BEFORE_PROMISE,
    }),
  ).toBe("medium");

  const shippedWithoutShippingDate = { ...shippedOrder, shippedOn: null };
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: cancellation,
      erpStageResult: assignedWith(withData(shippedWithoutShippingDate)),
      lookupDate: BEFORE_PROMISE,
    }),
  ).toBe("low");
});

test("R-17: medium stays medium, also when raised", () => {
  for (const intents of [cancellation, orderStatusQuestion]) {
    expect(
      deriveUrgencyAfterLookup({
        messageUrgency: "medium",
        intents,
        erpStageResult: assignedWith(withData(orderInProgress)),
        lookupDate: AFTER_PROMISE,
      }),
    ).toBe("medium");
  }
});

test("R-17: high stays high", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "high",
      intents: orderStatusQuestion,
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: AFTER_PROMISE,
    }),
  ).toBe("high");
});

test("R-17: both cases together give medium, not high", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: cancellation,
      erpStageResult: assignedWith(withData(orderInProgress)),
      lookupDate: AFTER_PROMISE,
    }),
  ).toBe("medium");
});

test("R-17: one order that qualifies is enough when several were looked up", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: orderStatusQuestion,
      erpStageResult: assignedWith(
        withData(deliveredOrder),
        withData(orderInProgress),
      ),
      lookupDate: AFTER_PROMISE,
    }),
  ).toBe("medium");
});

test("R-17: refused, invalid and unreachable lookups raise nothing, even for a cancellation", () => {
  expect(
    deriveUrgencyAfterLookup({
      messageUrgency: "low",
      intents: cancellation,
      erpStageResult: assignedWith(
        { kind: "refused" },
        { kind: "invalid" },
        { kind: "unreachable" },
      ),
      lookupDate: AFTER_PROMISE,
    }),
  ).toBe("low");
});

test("R-17: an unknown sender, an unreachable ERP or no order number raise nothing", () => {
  const stageResults: ErpStageResult[] = [
    { kind: "unknown_sender" },
    { kind: "unreachable" },
    assignedWith(),
  ];
  for (const erpStageResult of stageResults) {
    expect(
      deriveUrgencyAfterLookup({
        messageUrgency: "low",
        intents: cancellation,
        erpStageResult,
        lookupDate: AFTER_PROMISE,
      }),
    ).toBe("low");
  }
});
