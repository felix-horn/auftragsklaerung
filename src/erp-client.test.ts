import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { MockErpData } from "../mock-erp/data-schema.js";
import { createMockErp } from "../mock-erp/server.js";
import {
  createErpClient,
  describeErpProblem,
  type ErpProblem,
} from "./erp-client.js";
import { runErpStage } from "./erp-stage.js";

// The ERP client over real HTTP on this machine: no network beyond it, no
// API call. Part 1 runs against the mock ERP, part 2 against a server in
// this file that misbehaves on purpose. Pipeline code imports neither.
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

// A server that misbehaves, one way per order number and customer
// address. Invented; never part of the mock ERP, which only answers as the
// OpenAPI document says.
const misbehaviour: Record<string, (response: ServerResponse) => void> = {
  // A correct customer, so that runErpStage gets as far as the orders.
  "/customers?email=einkauf%40alpha.example": (response) =>
    sendJson(response, 200, data.customers[0]),
  // 200, but the customer has no customer number.
  "/customers?email=broken%40gamma.example": (response) =>
    sendJson(response, 200, { contactEmails: ["broken@gamma.example"] }),
  // 500 with a JSON body.
  "/orders/A-50000": (response) =>
    sendJson(response, 500, { error: "internal" }),
  // 200 with an HTML page instead of JSON.
  "/orders/A-50001": (response) => {
    response.setHeader("content-type", "text/html");
    response.end("<html><body>Kessler Fluidtechnik GmbH</body></html>");
  },
  // 200, but the order has no status.
  "/orders/A-50002": (response) =>
    sendJson(response, 200, {
      orderNumber: "A-50002",
      customerNumber: "K-20001",
      promisedDeliveryDate: "2026-11-02",
      shippedOn: null,
    }),
  // 200, but a date the contract doesn't allow.
  "/orders/A-50003": (response) =>
    sendJson(response, 200, {
      orderNumber: "A-50003",
      customerNumber: "K-20001",
      status: "in_progress",
      promisedDeliveryDate: "02.11.2026",
      shippedOn: null,
    }),
  // Accepts the request and never answers.
  "/orders/A-50004": () => { },
  // Sends the status and half a body, then nothing.
  "/orders/A-50005": (response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"orderNumber":');
  },
};

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

const mockErp = createMockErp(data);
const misbehavingErp: Server = createServer((request, response) =>
  misbehaviour[request.url ?? ""]?.(response),
);
let mockUrl = "";
let misbehavingUrl = "";
let closedPortUrl = "";

beforeAll(async () => {
  // The mock prints one line per request; keep the test output free of it.
  vi.spyOn(console, "log").mockImplementation(() => { });
  mockUrl = await listenOnFreePort(mockErp);
  misbehavingUrl = await listenOnFreePort(misbehavingErp);
  // A port that was free a moment ago and has nothing listening now.
  const closed = createServer();
  closedPortUrl = await listenOnFreePort(closed);
  await new Promise((resolve) => closed.close(resolve));
});

afterAll(async () => {
  // The hanging requests keep their connections open; end them, or close
  // would wait for them.
  misbehavingErp.closeAllConnections();
  await new Promise((resolve) => misbehavingErp.close(resolve));
  await new Promise((resolve) => mockErp.close(resolve));
  vi.restoreAllMocks();
});

async function listenOnFreePort(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

// A client whose reported problems the test can read.
function createClientWithProblems(
  baseUrl: string,
  timeoutMilliseconds = 200,
) {
  const problems: ErpProblem[] = [];
  const erp = createErpClient({
    baseUrl,
    reportProblem: (problem) => problems.push(problem),
    timeoutMilliseconds,
  });
  return { erp, problems };
}

// Part 1: the documented answers, from the mock ERP. None reports a
// problem.

test("a registered address: found, with the customer", async () => {
  const { erp, problems } = createClientWithProblems(mockUrl);
  expect(
    await erp.findCustomerByEmailAddress("einkauf@alpha.example"),
  ).toEqual({
    kind: "found",
    erpRecord: data.customers[0],
  });
  expect(problems).toEqual([]);
});

test("an address with a + is sent encoded and found", async () => {
  const { erp, problems } = createClientWithProblems(mockUrl);
  expect(
    await erp.findCustomerByEmailAddress("m.weber+erp@alpha.example"),
  ).toEqual({
    kind: "found",
    erpRecord: data.customers[0],
  });
  expect(problems).toEqual([]);
});

test("an address no customer has: not_found", async () => {
  const { erp, problems } = createClientWithProblems(mockUrl);
  expect(
    await erp.findCustomerByEmailAddress("nobody@alpha.example"),
  ).toEqual({
    kind: "not_found",
  });
  expect(problems).toEqual([]);
});

test("an existing order: found, with the order, whoever owns it", async () => {
  const { erp, problems } = createClientWithProblems(mockUrl);
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
  expect(problems).toEqual([]);
});

test("an order number the ERP doesn't have: not_found", async () => {
  const { erp, problems } = createClientWithProblems(mockUrl);
  expect(await erp.getOrderStatus("A-99999")).toEqual({ kind: "not_found" });
  expect(problems).toEqual([]);
});

test("runErpStage with the client: own order, another customer's, a missing one, an invalid number", async () => {
  const { erp, problems } = createClientWithProblems(mockUrl);
  const result = await runErpStage(
    {
      senderEmailAddress: "Einkauf@Alpha.example",
      orderNumbers: ["A-10001", "A-10003", "a99999", "K-20001"],
    },
    erp,
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      {
        extractedOrderNumber: "A-10001",
        outcome: { kind: "order", order: data.orders[0] },
      },
      { extractedOrderNumber: "A-10003", outcome: { kind: "refused" } },
      { extractedOrderNumber: "a99999", outcome: { kind: "refused" } },
      { extractedOrderNumber: "K-20001", outcome: { kind: "invalid" } },
    ],
  });
  expect(problems).toEqual([]);
});

// Part 2: every way to "unreachable", each with its problem for developers.

test("nothing listening: unreachable, no_connection", async () => {
  const { erp, problems } = createClientWithProblems(closedPortUrl);
  expect(await erp.getOrderStatus("A-10001")).toEqual({ kind: "unreachable" });
  expect(problems).toEqual([
    {
      kind: "no_connection",
      request: `GET ${closedPortUrl}/orders/A-10001`,
      status: null,
      detail: expect.stringMatching(/^ECONNREFUSED: /),
    },
  ]);
});

test("no answer within the timeout: unreachable, timeout", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl, 100);
  expect(await erp.getOrderStatus("A-50004")).toEqual({ kind: "unreachable" });
  expect(problems).toEqual([
    {
      kind: "timeout",
      request: `GET ${misbehavingUrl}/orders/A-50004`,
      status: null,
      detail: "no complete answer within 100 ms",
    },
  ]);
});

test("the body stops halfway: unreachable, timeout, with the status that came", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl, 100);
  expect(await erp.getOrderStatus("A-50005")).toEqual({ kind: "unreachable" });
  expect(problems).toMatchObject([{ kind: "timeout", status: 200 }]);
});

test("a status the document doesn't list: unreachable, unexpected_status", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl);
  expect(await erp.getOrderStatus("A-50000")).toEqual({ kind: "unreachable" });
  expect(problems).toEqual([
    {
      kind: "unexpected_status",
      request: `GET ${misbehavingUrl}/orders/A-50000`,
      status: 500,
      detail: "status 500",
    },
  ]);
});

test("a body that isn't JSON: unreachable, not_json, without quoting the body", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl);
  expect(await erp.getOrderStatus("A-50001")).toEqual({ kind: "unreachable" });
  expect(problems).toEqual([
    {
      kind: "not_json",
      request: `GET ${misbehavingUrl}/orders/A-50001`,
      status: 200,
      detail: "content type text/html",
    },
  ]);
});

test("an order without status: unreachable, breaks_contract, naming the field", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl);
  expect(await erp.getOrderStatus("A-50002")).toEqual({ kind: "unreachable" });
  expect(problems).toEqual([
    {
      kind: "breaks_contract",
      request: `GET ${misbehavingUrl}/orders/A-50002`,
      status: 200,
      detail:
        'status: Invalid option: expected one of "in_progress"|"shipped"|"delivered"',
    },
  ]);
});

test("a date in the wrong format: breaks_contract, without the value the ERP sent", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl);
  expect(await erp.getOrderStatus("A-50003")).toEqual({ kind: "unreachable" });
  expect(problems).toMatchObject([
    {
      kind: "breaks_contract",
      status: 200,
      detail: "promisedDeliveryDate: Invalid ISO date",
    },
  ]);
  expect(problems[0].detail).not.toContain("02.11.2026");
});

test("a customer without customer number: unreachable, breaks_contract", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl);
  expect(
    await erp.findCustomerByEmailAddress("broken@gamma.example"),
  ).toEqual({
    kind: "unreachable",
  });
  expect(problems).toMatchObject([
    {
      kind: "breaks_contract",
      request: `GET ${misbehavingUrl}/customers?email=broken%40gamma.example`,
      status: 200,
      detail:
        "customerNumber: Invalid input: expected string, received undefined",
    },
  ]);
});

test("a wrong base URL: unreachable, breaks_contract on the 404, not not_found", async () => {
  // The mock answers 404 "no such endpoint" for /api/…: a 404, but not the
  // documented one.
  const { erp, problems } = createClientWithProblems(`${mockUrl}/api`);
  expect(
    await erp.findCustomerByEmailAddress("einkauf@alpha.example"),
  ).toEqual({
    kind: "unreachable",
  });
  expect(await erp.getOrderStatus("A-10001")).toEqual({ kind: "unreachable" });
  expect(problems.map(describeErpProblem)).toEqual([
    `ERP lookup unusable (breaks_contract): GET ${mockUrl}/api/customers?email=einkauf%40alpha.example → 404: error: Invalid input: expected "no customer with this contact address" (not the documented 404: is ERP_BASE_URL right?)`,
    `ERP lookup unusable (breaks_contract): GET ${mockUrl}/api/orders/A-10001 → 404: error: Invalid input: expected "no order with this number" (not the documented 404: is ERP_BASE_URL right?)`,
  ]);
});

test("runErpStage with a failing order lookup: the outcome carries no details, the problem goes to the reporter", async () => {
  const { erp, problems } = createClientWithProblems(misbehavingUrl);
  const result = await runErpStage(
    { senderEmailAddress: "einkauf@alpha.example", orderNumbers: ["A-50002"] },
    erp,
  );
  expect(result).toEqual({
    kind: "assigned",
    customerNumber: "K-20001",
    orders: [
      { extractedOrderNumber: "A-50002", outcome: { kind: "unreachable" } },
    ],
  });
  expect(problems).toMatchObject([{ kind: "breaks_contract", status: 200 }]);
});
