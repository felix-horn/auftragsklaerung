import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { z } from "zod";
import {
  customerSchema,
  errorBodySchema,
  orderSchema,
} from "../src/erp-contract.js";
import type { ErpData } from "./data-schema.js";
import { createMockErp } from "./server.js";

// The mock ERP's answers against the ERP's contract: for every answer the
// OpenAPI document lists (contracts/erp-openapi.json), the mock must send
// that status, JSON, and a body the generated Zod schema accepts. A real
// HTTP connection on this machine, no network beyond it, no API call.
//
// Invented records, the same invented customers as data-schema.test.ts.
// None is copied from the golden set, from POLICY.md or from
// mock-erp/data.json.
const data: ErpData = {
  customers: [
    {
      customerNumber: "K-20001",
      contactEmails: ["einkauf@alpha.example", "m.weber@alpha.example"],
    },
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
      customerNumber: "K-20001",
      status: "delivered",
      promisedDeliveryDate: null,
      shippedOn: "2026-10-01",
    },
  ],
};

const server = createMockErp(data);
let baseUrl = "";

beforeAll(async () => {
  // The mock prints one line per request (server.ts); keep the test
  // output free of them.
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Port 0: the system picks a free port, so the test never collides with
  // a mock ERP started by `npm run erp` on 4100.
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  vi.restoreAllMocks();
});

// One request, and what the contract says about its answer.
async function expectDocumentedAnswer(
  path: string,
  status: number,
  schema: z.ZodType,
) {
  const response = await fetch(`${baseUrl}${path}`);
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toBe("application/json");
  const result = schema.safeParse(await response.json());
  expect(result.error?.issues ?? []).toEqual([]);
}

test("GET /customers with a registered address: 200, a Customer", async () => {
  await expectDocumentedAnswer(
    "/customers?email=m.weber%40alpha.example",
    200,
    customerSchema,
  );
});

test("GET /customers with an unknown address: 404, an ErrorResponse", async () => {
  await expectDocumentedAnswer(
    "/customers?email=nobody%40alpha.example",
    404,
    errorBodySchema,
  );
});

test("GET /customers without email: 400, an ErrorResponse", async () => {
  await expectDocumentedAnswer("/customers", 400, errorBodySchema);
});

test("GET /orders/{orderNumber}, an order in progress and a delivered one: 200, an Order", async () => {
  await expectDocumentedAnswer("/orders/A-10001", 200, orderSchema);
  await expectDocumentedAnswer("/orders/A-10003", 200, orderSchema);
});

test("GET /orders/{orderNumber} with an unknown number: 404, an ErrorResponse", async () => {
  await expectDocumentedAnswer("/orders/A-99999", 404, errorBodySchema);
});
