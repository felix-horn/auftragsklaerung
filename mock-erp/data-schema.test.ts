import { expect, test } from "vitest";
import { erpDataSchema } from "./data-schema.js";

// Invented customers and orders. None is copied from the golden set or from
// POLICY.md. Each test changes one thing in a fresh copy and expects exactly
// the problem that change causes.
function validData() {
  return {
    customers: [
      {
        customerNumber: "K-20001",
        contactEmails: ["einkauf@alpha.example", "m.weber@alpha.example"],
      },
      { customerNumber: "K-20002", contactEmails: ["bestellung@beta.example"] },
    ],
    orders: [
      {
        orderNumber: "A-10001",
        customerNumber: "K-20001",
        status: "in_progress",
        promisedDeliveryDate: "2026-11-02",
        shippedOn: null as string | null,
      },
      {
        orderNumber: "A-10002",
        customerNumber: "K-20001",
        status: "shipped",
        promisedDeliveryDate: "2026-10-23",
        shippedOn: "2026-10-20" as string | null,
      },
      {
        orderNumber: "A-10003",
        customerNumber: "K-20002",
        status: "delivered",
        promisedDeliveryDate: null as string | null,
        shippedOn: "2026-10-01" as string | null,
      },
    ],
  };
}

// Every problem erpDataSchema finds, as "where: what": the contract's own
// checks plus the data file's rules (lower case, nothing twice).
function problems(data: unknown): string[] {
  const result = erpDataSchema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
}

test("all three statuses, one order without a promised date: no problems", () => {
  expect(problems(validData())).toEqual([]);
});

// Since Module 4.5 the contract comes from the ERP's OpenAPI document,
// which describes one order shape for every status. Until 4.4 our own
// contract refused both of these.
test("the contract does not tie the shipping date to the status", () => {
  const inProgressWithDate = validData();
  inProgressWithDate.orders[0].shippedOn = "2026-10-20";
  expect(problems(inProgressWithDate)).toEqual([]);

  const shippedWithoutDate = validData();
  shippedWithoutDate.orders[1].shippedOn = null;
  expect(problems(shippedWithoutDate)).toEqual([]);
});

test("a status outside the three is refused", () => {
  const data = validData();
  data.orders[0].status = "cancelled";
  expect(problems(data)).toEqual([
    'orders.0.status: Invalid option: expected one of "in_progress"|"shipped"|"delivered"',
  ]);
});

test("a missing promisedDeliveryDate field is not the same as null", () => {
  const data = validData();
  Reflect.deleteProperty(data.orders[0], "promisedDeliveryDate");
  expect(problems(data)).toEqual([
    "orders.0.promisedDeliveryDate: Invalid input: expected string, received undefined",
  ]);
});

test("an order number with four digits is refused (R-09: five)", () => {
  const data = validData();
  data.orders[0].orderNumber = "A-1001";
  expect(problems(data)).toEqual([
    "orders.0.orderNumber: Invalid string: must match pattern /^A-\\d{5}$/",
  ]);
});

test("dates are YYYY-MM-DD and must exist", () => {
  const german = validData();
  german.orders[1].promisedDeliveryDate = "23.10.2026";
  expect(problems(german)).toEqual([
    "orders.1.promisedDeliveryDate: Invalid ISO date",
  ]);

  const impossible = validData();
  impossible.orders[1].promisedDeliveryDate = "2026-02-30";
  expect(problems(impossible)).toEqual([
    "orders.1.promisedDeliveryDate: Invalid ISO date",
  ]);
});

test("a contact address with a capital letter is refused", () => {
  const data = validData();
  data.customers[0].contactEmails[1] = "M.Weber@alpha.example";
  expect(problems(data)).toEqual([
    "customers.0.contactEmails.1: must be lower case",
  ]);
});

test("one address at two customers is refused", () => {
  const data = validData();
  data.customers[1].contactEmails.push("einkauf@alpha.example");
  expect(problems(data)).toEqual([
    "customers: contact address einkauf@alpha.example appears more than once",
  ]);
});

test("the same order number twice is refused", () => {
  const data = validData();
  data.orders[2].orderNumber = "A-10001";
  expect(problems(data)).toEqual([
    "orders: order number A-10001 appears more than once",
  ]);
});
