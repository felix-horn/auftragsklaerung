import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { MockErpData } from "../mock-erp/data-schema.js";
import { createMockErp } from "../mock-erp/server.js";
import { createErpClient } from "./erp-client.js";
import { runErpStage } from "./erp-stage.js";

// The ERP client against the mock ERP, started here on a free port: real
// HTTP on this machine, no network beyond it, no API call. The mock stands
// in for the ERP; pipeline code never imports it.
//
// Invented records, the same invented customers as src/erp-stage.test.ts
// (K-20001 at alpha.example, K-20002 at beta.example). None is copied from
// the golden set, from POLICY.md or from mock-erp/data.json.
const data: MockErpData = {
  customers: [
    {
      customerNumber: "K-20001",
      contactEmails: ["einkauf@alpha.example", "m.weber+erp@alpha.example"],
    },
    { customerNumber: "K-20002", contactEmails: ["bestellung@beta.example"] },
  ],
  orders: [
    {
      orderNumber: "A-10001",
      customerNumber: "K-20001",
      status: "in_progress",
      promisedDeliveryDate: "2026-11-02",
      shippedOn: null,
    },
    {
      orderNumber: "A-10003",
      customerNumber: "K-20002",
      status: "delivered",
      promisedDeliveryDate: null,
      shippedOn: "2026-10-01",
    },
  ],
};

const server = createMockErp(data);
let baseUrl = "";

beforeAll(async () => {
  // The mock prints one line per request; keep the test output free of it.
  vi.spyOn(console, "log").mockImplementation(() => {});
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  vi.restoreAllMocks();
});

test("a registered address: found, with the customer", async () => {
  const erp = createErpClient(baseUrl);
  expect(await erp.findCustomerBySender("einkauf@alpha.example")).toEqual({
    kind: "found",
    erpRecord: data.customers[0],
  });
});

test("an address with a + is sent encoded and found", async () => {
  const erp = createErpClient(baseUrl);
  expect(await erp.findCustomerBySender("m.weber+erp@alpha.example")).toEqual({
    kind: "found",
    erpRecord: data.customers[0],
  });
});

test("an address no customer has: not_found", async () => {
  const erp = createErpClient(baseUrl);
  expect(await erp.findCustomerBySender("nobody@alpha.example")).toEqual({
    kind: "not_found",
  });
});

test("an existing order: found, with the order, whoever owns it", async () => {
  const erp = createErpClient(baseUrl);
  expect(await erp.getOrderStatus("A-10001")).toEqual({
    kind: "found",
    erpRecord: data.orders[0],
  });
  // The client doesn't decide who may see an order: R-16 is
  // revealOrderOnlyToOwner's job.
  expect(await erp.getOrderStatus("A-10003")).toEqual({
    kind: "found",
    erpRecord: data.orders[1],
  });
});

test("an order number the ERP doesn't have: not_found", async () => {
  const erp = createErpClient(baseUrl);
  expect(await erp.getOrderStatus("A-99999")).toEqual({ kind: "not_found" });
});

test("a wrong base URL: unreachable, not not_found", async () => {
  // The mock answers 404 "no such endpoint" for /api/customers: a 404, but
  // not the documented one.
  const erp = createErpClient(`${baseUrl}/api`);
  expect(await erp.findCustomerBySender("einkauf@alpha.example")).toEqual({
    kind: "unreachable",
  });
  expect(await erp.getOrderStatus("A-10001")).toEqual({ kind: "unreachable" });
});

test("runErpStage with the client: own order, another customer's, a missing one, an invalid number", async () => {
  const result = await runErpStage(
    {
      senderAddress: "Einkauf@Alpha.example",
      orderNumbers: ["A-10001", "A-10003", "a99999", "K-20001"],
    },
    createErpClient(baseUrl),
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      { extractedOrderNumber: "A-10001", outcome: { kind: "order", order: data.orders[0] } },
      { extractedOrderNumber: "A-10003", outcome: { kind: "refused" } },
      { extractedOrderNumber: "a99999", outcome: { kind: "refused" } },
      { extractedOrderNumber: "K-20001", outcome: { kind: "invalid" } },
    ],
  });
});
