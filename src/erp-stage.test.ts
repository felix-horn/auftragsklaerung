import { expect, test } from "vitest";
import type { Order } from "./erp-contract.js";
import {
  orderNumberForLookup,
  orderOutcome,
  senderAddressForLookup,
} from "./erp-stage.js";

// Invented addresses and numbers, from the same invented customers as
// src/erp-contract.test.ts (K-20001 at alpha.example, K-20002 at
// beta.example). None is copied from the golden set, from POLICY.md or from
// mock-erp/data.json.

// R-14: which address is looked up

test("R-14: upper and lower case don't matter: the address is looked up in lower case", () => {
  expect(senderAddressForLookup("M.Weber@Alpha.example")).toBe(
    "m.weber@alpha.example",
  );
  expect(senderAddressForLookup("EINKAUF@ALPHA.EXAMPLE")).toBe(
    "einkauf@alpha.example",
  );
});

test("R-14: an address in lower case is looked up unchanged", () => {
  expect(senderAddressForLookup("bestellung@beta.example")).toBe(
    "bestellung@beta.example",
  );
});

// R-15: which number is looked up

test("R-15: A- plus five digits is looked up as recorded", () => {
  expect(orderNumberForLookup("A-10001")).toBe("A-10001");
});

test("R-15: five digits without prefix are looked up with A- in front", () => {
  expect(orderNumberForLookup("10001")).toBe("A-10001");
});

test("R-15: a lower-case prefix or a missing hyphen is looked up as A- plus five digits", () => {
  expect(orderNumberForLookup("a-10001")).toBe("A-10001");
  expect(orderNumberForLookup("A10001")).toBe("A-10001");
  expect(orderNumberForLookup("a10001")).toBe("A-10001");
});

test("R-15: too few or too many digits: not a valid order number", () => {
  expect(orderNumberForLookup("1000")).toBeNull();
  expect(orderNumberForLookup("100011")).toBeNull();
  expect(orderNumberForLookup("A-1000")).toBeNull();
  expect(orderNumberForLookup("A-100011")).toBeNull();
  expect(orderNumberForLookup("A100011")).toBeNull();
});

test("R-15: a space or any other character between prefix and digits makes it invalid", () => {
  expect(orderNumberForLookup("A 10001")).toBeNull();
  expect(orderNumberForLookup("A- 10001")).toBeNull();
  expect(orderNumberForLookup("A--10001")).toBeNull();
  expect(orderNumberForLookup("-10001")).toBeNull();
});

test("R-15: a customer number recorded as an order number is not looked up", () => {
  expect(orderNumberForLookup("K-20001")).toBeNull();
  expect(orderNumberForLookup("K20001")).toBeNull();
});

test("R-15: other numbers recorded by mistake are not looked up", () => {
  expect(orderNumberForLookup("2026-0417")).toBeNull(); // shaped like an invoice number
  expect(orderNumberForLookup("")).toBeNull();
});

test("limit: any five digits get A-, also a customer number recorded without its prefix", () => {
  expect(orderNumberForLookup("20001")).toBe("A-20001");
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
    orderOutcome("K-20001", { kind: "found", record: ownOrderInProgress }),
  ).toEqual({ kind: "order", order: ownOrderInProgress });
  expect(
    orderOutcome("K-20001", { kind: "found", record: ownOrderShipped }),
  ).toEqual({ kind: "order", order: ownOrderShipped });
});

test("R-16: another customer's order is refused, with nothing about the order", () => {
  expect(
    orderOutcome("K-20001", { kind: "found", record: otherCustomersOrder }),
  ).toEqual({ kind: "refused" });
});

test("R-16: a missing order is refused", () => {
  expect(orderOutcome("K-20001", { kind: "not_found" })).toEqual({
    kind: "refused",
  });
});

test("R-16: another customer's order and a missing order give the same outcome", () => {
  expect(
    orderOutcome("K-20001", { kind: "found", record: otherCustomersOrder }),
  ).toEqual(orderOutcome("K-20001", { kind: "not_found" }));
});

test("R-16: an unreachable ERP is not a refusal", () => {
  expect(orderOutcome("K-20001", { kind: "unreachable" })).toEqual({
    kind: "unreachable",
  });
});

test("R-16: the same order is refused for one customer and shown to its owner", () => {
  const answer = { kind: "found", record: otherCustomersOrder } as const;
  expect(orderOutcome("K-20001", answer)).toEqual({ kind: "refused" });
  expect(orderOutcome("K-20002", answer)).toEqual({
    kind: "order",
    order: otherCustomersOrder,
  });
});
