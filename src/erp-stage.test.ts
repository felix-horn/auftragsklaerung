import { expect, test } from "vitest";
import { orderNumberForLookup, senderAddressForLookup } from "./erp-stage.js";

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
