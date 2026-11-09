import { type LanguageModelUsage, NoOutputGeneratedError } from "ai";
import { expect, test } from "vitest";
import type { Customer, Order } from "./erp-contract.js";
import type { Erp } from "./erp-stage.js";
import { type ExtractEmail, processEmail } from "./process-email.js";
import type { EmailExtraction } from "./schema.js";

// The whole pipeline with a fake model request and a fake ERP: no API
// call, no server. These tests check the joining, which result goes where.
// The rules themselves are tested next to their functions
// (src/urgency.test.ts, src/erp-stage.test.ts).
//
// Invented records, the same invented customers as src/erp-stage.test.ts
// (K-20001 at alpha.example, K-20002 at beta.example). None is copied from
// the golden set, from POLICY.md or from mock-erp/data.json.

const customers: Customer[] = [
  { customerNumber: "K-20001", contactEmails: ["einkauf@alpha.example"] },
  { customerNumber: "K-20002", contactEmails: ["bestellung@beta.example"] },
];

// K-20001's order: promised for 2026-11-10, not shipped yet.
const ownOrder: Order = {
  orderNumber: "A-10001",
  customerNumber: "K-20001",
  status: "in_progress",
  promisedDeliveryDate: "2026-11-10",
  shippedOn: null,
};

// What the fake model records: a question about A-10001, no escalation
// signal, no deadline, so the urgency of the message is low (R-13). Tests
// change what they need.
const statusQuestion: EmailExtraction = {
  intents: [{ type: "order_status", confidence: 0.95 }],
  requestedAction: "Lieferstatus mitteilen",
  orderNumbers: ["A-10001"],
  customerNumbers: [],
  escalationSignals: [],
  deadlineStated: null,
};

// Invented token counts. processEmail passes them on unchanged.
const usage: LanguageModelUsage = {
  inputTokens: 1900,
  inputTokenDetails: {
    noCacheTokens: 1900,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokens: 120,
  outputTokenDetails: { textTokens: 80, reasoningTokens: 40 },
  totalTokens: 2020,
};

// A fake model request: answers every email with the given extraction and
// notes every email text it was given.
function fakeExtraction(extraction: EmailExtraction) {
  const emailTexts: string[] = [];
  const extractEmail: ExtractEmail = async (emailText) => {
    emailTexts.push(emailText);
    return { output: extraction, usage };
  };
  return { extractEmail, emailTexts };
}

// A fake ERP, as in src/erp-stage.test.ts: exact matching, no business
// rule, every lookup noted in `calls`.
function fakeErp() {
  const calls: string[] = [];
  const erp: Erp = {
    findCustomerByEmailAddress: async (senderEmailAddress) => {
      calls.push(`customer ${senderEmailAddress}`);
      const matchingCustomer = customers.find((customer) =>
        customer.contactEmails.includes(senderEmailAddress),
      );
      return matchingCustomer
        ? { kind: "found", erpRecord: matchingCustomer }
        : { kind: "not_found" };
    },
    getOrderStatus: async (orderNumber) => {
      calls.push(`order ${orderNumber}`);
      return orderNumber === ownOrder.orderNumber
        ? { kind: "found", erpRecord: ownOrder }
        : { kind: "not_found" };
    },
  };
  return { erp, calls };
}

test("own order with a passed promise: the message stays low, after the lookup it is medium", async () => {
  const { extractEmail, emailTexts } = fakeExtraction(statusQuestion);
  const { erp, calls } = fakeErp();

  const result = await processEmail(
    {
      emailText: "Wo bleibt A-10001?",
      senderEmailAddress: "einkauf@alpha.example",
      lookupDate: "2026-11-11",
    },
    { extractEmail, erp },
  );

  expect(result).toEqual({
    extraction: statusQuestion,
    extractionUsage: usage,
    messageUrgency: "low",
    erpStageResult: {
      kind: "assigned",
      customerNumber: "K-20001",
      orders: [
        {
          extractedOrderNumber: "A-10001",
          outcome: { kind: "order", order: ownOrder },
        },
      ],
    },
    urgencyAfterLookup: "medium",
  });
  expect(emailTexts).toEqual(["Wo bleibt A-10001?"]);
  expect(calls).toEqual(["customer einkauf@alpha.example", "order A-10001"]);
});

test("R-17: the lookup day passed in decides: on the promised day the urgency is not raised", async () => {
  const { extractEmail } = fakeExtraction(statusQuestion);
  const { erp } = fakeErp();

  const result = await processEmail(
    {
      emailText: "Wo bleibt A-10001?",
      senderEmailAddress: "einkauf@alpha.example",
      lookupDate: "2026-11-10",
    },
    { extractEmail, erp },
  );

  expect(result.messageUrgency).toBe("low");
  expect(result.urgencyAfterLookup).toBe("low");
});

test("R-14: a customer number in the text assigns nobody: unknown sender, no order looked up", async () => {
  const { extractEmail } = fakeExtraction({
    ...statusQuestion,
    customerNumbers: ["K-20001"],
  });
  const { erp, calls } = fakeErp();

  const result = await processEmail(
    {
      emailText: "Kundennummer K-20001: wo bleibt A-10001?",
      senderEmailAddress: "info@gamma.example",
      lookupDate: "2026-11-11",
    },
    { extractEmail, erp },
  );

  expect(result.erpStageResult).toEqual({ kind: "unknown_sender" });
  expect(result.urgencyAfterLookup).toBe("low");
  expect(calls).toEqual(["customer info@gamma.example"]);
});

test("R-15: only the extracted order numbers are looked up, never the customer numbers", async () => {
  const { extractEmail } = fakeExtraction({
    ...statusQuestion,
    customerNumbers: ["K-20002"],
  });
  const { erp, calls } = fakeErp();

  const result = await processEmail(
    {
      emailText: "Wo bleibt A-10001? Unsere Kundennummer ist K-20002.",
      senderEmailAddress: "einkauf@alpha.example",
      lookupDate: "2026-11-11",
    },
    { extractEmail, erp },
  );

  expect(result.erpStageResult).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      {
        extractedOrderNumber: "A-10001",
        outcome: { kind: "order", order: ownOrder },
      },
    ],
  });
  expect(calls).toEqual(["customer einkauf@alpha.example", "order A-10001"]);
});

test("a failed extraction stops the pipeline: its error comes through unchanged, the ERP is not asked", async () => {
  // The model finished without an answer to check (CLAUDE.md, Eval harness).
  const failure = new NoOutputGeneratedError();
  const extractEmail: ExtractEmail = async () => {
    throw failure;
  };
  const { erp, calls } = fakeErp();

  await expect(
    processEmail(
      {
        emailText: "Wo bleibt A-10001?",
        senderEmailAddress: "einkauf@alpha.example",
        lookupDate: "2026-11-11",
      },
      { extractEmail, erp },
    ),
  ).rejects.toBe(failure);
  expect(calls).toEqual([]);
});