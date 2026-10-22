import { expect, test } from "vitest";
import type { Customer, Order } from "./erp-contract.js";
import {
  decideOrderOutcome,
  type Erp,
  normaliseOrderNumber,
  normaliseSenderAddress,
  runErpStage,
} from "./erp-stage.js";

// Invented addresses and numbers, from the same invented customers as
// src/erp-contract.test.ts (K-20001 at alpha.example, K-20002 at
// beta.example). None is copied from the golden set, from POLICY.md or from
// mock-erp/data.json.

// R-14: which address is looked up

test("R-14: upper and lower case don't matter: the address is looked up in lower case", () => {
  expect(normaliseSenderAddress("M.Weber@Alpha.example")).toBe(
    "m.weber@alpha.example",
  );
  expect(normaliseSenderAddress("EINKAUF@ALPHA.EXAMPLE")).toBe(
    "einkauf@alpha.example",
  );
});

test("R-14: an address in lower case is looked up unchanged", () => {
  expect(normaliseSenderAddress("bestellung@beta.example")).toBe(
    "bestellung@beta.example",
  );
});

// R-15: which number is looked up

test("R-15: A- plus five digits is looked up as recorded", () => {
  expect(normaliseOrderNumber("A-10001")).toBe("A-10001");
});

test("R-15: five digits without prefix are looked up with A- in front", () => {
  expect(normaliseOrderNumber("10001")).toBe("A-10001");
});

test("R-15: a lower-case prefix or a missing hyphen is looked up as A- plus five digits", () => {
  expect(normaliseOrderNumber("a-10001")).toBe("A-10001");
  expect(normaliseOrderNumber("A10001")).toBe("A-10001");
  expect(normaliseOrderNumber("a10001")).toBe("A-10001");
});

test("R-15: too few or too many digits: not a valid order number", () => {
  expect(normaliseOrderNumber("1000")).toBeNull();
  expect(normaliseOrderNumber("100011")).toBeNull();
  expect(normaliseOrderNumber("A-1000")).toBeNull();
  expect(normaliseOrderNumber("A-100011")).toBeNull();
  expect(normaliseOrderNumber("A100011")).toBeNull();
});

test("R-15: a space or any other character between prefix and digits makes it invalid", () => {
  expect(normaliseOrderNumber("A 10001")).toBeNull();
  expect(normaliseOrderNumber("A- 10001")).toBeNull();
  expect(normaliseOrderNumber("A--10001")).toBeNull();
  expect(normaliseOrderNumber("-10001")).toBeNull();
});

test("R-15: a customer number recorded as an order number is not looked up", () => {
  expect(normaliseOrderNumber("K-20001")).toBeNull();
  expect(normaliseOrderNumber("K20001")).toBeNull();
});

test("R-15: other numbers recorded by mistake are not looked up", () => {
  expect(normaliseOrderNumber("2026-0417")).toBeNull(); // shaped like an invoice number
  expect(normaliseOrderNumber("")).toBeNull();
});

test("limit: any five digits get A-, also a customer number recorded without its prefix", () => {
  expect(normaliseOrderNumber("20001")).toBe("A-20001");
});

// R-16: the outcome per looked-up number. The asking customer is K-20001.
// A-10001 and A-10002 are its orders, A-10003 belongs to K-20002.

const ownOrderInProgress: Order = {
  orderNumber: "A-10001",
  customerNumber: "K-20001",
  status: "in_progress",
  promisedDeliveryDate: "2026-11-02",
  shippedOn: null,
};

const ownOrderShipped: Order = {
  orderNumber: "A-10002",
  customerNumber: "K-20001",
  status: "shipped",
  promisedDeliveryDate: "2026-10-23",
  shippedOn: "2026-10-20",
};

const otherCustomersOrder: Order = {
  orderNumber: "A-10003",
  customerNumber: "K-20002",
  status: "delivered",
  promisedDeliveryDate: null,
  shippedOn: "2026-10-01",
};

test("R-16: the asking customer's own order: status, promised date and shipping date", () => {
  expect(
    decideOrderOutcome("K-20001", { kind: "found", record: ownOrderInProgress }),
  ).toEqual({ kind: "order", order: ownOrderInProgress });
  expect(
    decideOrderOutcome("K-20001", { kind: "found", record: ownOrderShipped }),
  ).toEqual({ kind: "order", order: ownOrderShipped });
});

test("R-16: another customer's order is refused, with nothing about the order", () => {
  expect(
    decideOrderOutcome("K-20001", { kind: "found", record: otherCustomersOrder }),
  ).toEqual({ kind: "refused" });
});

test("R-16: a missing order is refused", () => {
  expect(decideOrderOutcome("K-20001", { kind: "not_found" })).toEqual({
    kind: "refused",
  });
});

test("R-16: another customer's order and a missing order give the same outcome", () => {
  expect(
    decideOrderOutcome("K-20001", { kind: "found", record: otherCustomersOrder }),
  ).toEqual(decideOrderOutcome("K-20001", { kind: "not_found" }));
});

test("R-16: an unreachable ERP is not a refusal", () => {
  expect(decideOrderOutcome("K-20001", { kind: "unreachable" })).toEqual({
    kind: "unreachable",
  });
});

test("R-16: the same order is refused for one customer and shown to its owner", () => {
  const answer = { kind: "found", record: otherCustomersOrder } as const;
  expect(decideOrderOutcome("K-20001", answer)).toEqual({ kind: "refused" });
  expect(decideOrderOutcome("K-20002", answer)).toEqual({
    kind: "order",
    order: otherCustomersOrder,
  });
});

// The whole stage against a fake ERP: an in-memory stand-in with the same
// two lookups as the real one. It matches exactly, like the mock ERP, and
// applies no business rule. Every lookup is noted in `calls`, so a test can
// check what was asked and what wasn't. Addresses and order numbers listed
// in `unreachable` fail as if the ERP were down.

const customers: Customer[] = [
  {
    customerNumber: "K-20001",
    contactEmails: ["einkauf@alpha.example", "m.weber@alpha.example"],
  },
  { customerNumber: "K-20002", contactEmails: ["bestellung@beta.example"] },
];
const orders: Order[] = [ownOrderInProgress, ownOrderShipped, otherCustomersOrder];

function fakeErp(unreachable: string[] = []) {
  const calls: string[] = [];
  const erp: Erp = {
    async findCustomerBySender(address) {
      calls.push(`customer ${address}`);
      if (unreachable.includes(address)) return { kind: "unreachable" };
      const customer = customers.find((c) => c.contactEmails.includes(address));
      return customer
        ? { kind: "found", record: customer }
        : { kind: "not_found" };
    },
    async getOrderStatus(orderNumber) {
      calls.push(`order ${orderNumber}`);
      if (unreachable.includes(orderNumber)) return { kind: "unreachable" };
      const order = orders.find((o) => o.orderNumber === orderNumber);
      return order ? { kind: "found", record: order } : { kind: "not_found" };
    },
  };
  return { erp, calls };
}

test("stage: own order from a registered address", async () => {
  const { erp, calls } = fakeErp();
  const result = await runErpStage(
    { senderAddress: "m.weber@alpha.example", orderNumbers: ["A-10001"] },
    erp,
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      { recorded: "A-10001", outcome: { kind: "order", order: ownOrderInProgress } },
    ],
  });
  expect(calls).toEqual(["customer m.weber@alpha.example", "order A-10001"]);
});

test("stage R-14: the sender address is looked up in lower case", async () => {
  const { erp, calls } = fakeErp();
  const result = await runErpStage(
    { senderAddress: "M.Weber@Alpha.example", orderNumbers: [] },
    erp,
  );
  expect(result).toEqual({ kind: "assigned", customerNumber: "K-20001", orders: [] });
  expect(calls).toEqual(["customer m.weber@alpha.example"]);
});

test("stage R-14: another contact address of the same customer assigns the same customer", async () => {
  const { erp } = fakeErp();
  const result = await runErpStage(
    { senderAddress: "einkauf@alpha.example", orderNumbers: [] },
    erp,
  );
  expect(result).toEqual({ kind: "assigned", customerNumber: "K-20001", orders: [] });
});

test("stage R-14, R-15: an unknown sender gets nothing looked up, even for an existing order", async () => {
  const { erp, calls } = fakeErp();
  const result = await runErpStage(
    { senderAddress: "m.weber@freemail.example", orderNumbers: ["A-10001"] },
    erp,
  );
  expect(result).toEqual({ kind: "unknown_sender" });
  expect(calls).toEqual(["customer m.weber@freemail.example"]);
});

test("stage R-14: an unreachable ERP at the sender lookup is not an unknown sender", async () => {
  const { erp, calls } = fakeErp(["m.weber@alpha.example"]);
  const result = await runErpStage(
    { senderAddress: "m.weber@alpha.example", orderNumbers: ["A-10001"] },
    erp,
  );
  expect(result).toEqual({ kind: "unreachable" });
  expect(calls).toEqual(["customer m.weber@alpha.example"]);
});

test("stage R-15, R-16: one outcome per recorded number, in the recorded order", async () => {
  const { erp, calls } = fakeErp();
  const result = await runErpStage(
    {
      senderAddress: "m.weber@alpha.example",
      orderNumbers: ["10002", "A-10003", "A-19999", "1000"],
    },
    erp,
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      { recorded: "10002", outcome: { kind: "order", order: ownOrderShipped } },
      { recorded: "A-10003", outcome: { kind: "refused" } },
      { recorded: "A-19999", outcome: { kind: "refused" } },
      { recorded: "1000", outcome: { kind: "invalid" } },
    ],
  });
  // "1000" is not a valid order number, so it is never sent to the ERP.
  expect(calls).toEqual([
    "customer m.weber@alpha.example",
    "order A-10002",
    "order A-10003",
    "order A-19999",
  ]);
});

test("stage R-16: one unreachable order lookup does not affect the others", async () => {
  const { erp } = fakeErp(["A-10002"]);
  const result = await runErpStage(
    { senderAddress: "m.weber@alpha.example", orderNumbers: ["A-10001", "A-10002"] },
    erp,
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      { recorded: "A-10001", outcome: { kind: "order", order: ownOrderInProgress } },
      { recorded: "A-10002", outcome: { kind: "unreachable" } },
    ],
  });
});

test("stage: the same order recorded twice is looked up twice: nothing is merged", async () => {
  const { erp, calls } = fakeErp();
  const result = await runErpStage(
    { senderAddress: "m.weber@alpha.example", orderNumbers: ["A-10001", "a10001"] },
    erp,
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      { recorded: "A-10001", outcome: { kind: "order", order: ownOrderInProgress } },
      { recorded: "a10001", outcome: { kind: "order", order: ownOrderInProgress } },
    ],
  });
  expect(calls).toEqual([
    "customer m.weber@alpha.example",
    "order A-10001",
    "order A-10001",
  ]);
});
