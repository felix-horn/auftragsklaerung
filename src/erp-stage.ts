import type { Customer, Order } from "./erp-contract.js";

// Rules of the ERP stage (POLICY.md R-14 to R-16; CLAUDE.md, ERP stage).
// They belong to our code, not to the ERP: the ERP compares addresses
// exactly, never adds "A-" and returns any order to any caller (CLAUDE.md,
// Mock ERP).

/**
 * R-14: the sender address in lower case, because upper and lower case
 * don't matter. The ERP stores contact addresses in lower case and compares
 * them exactly (contracts/erp-api.json, GET /customers).
 *
 * Expects the bare address ("m.weber@alpha.example"), not a header with a
 * display name ("Max Weber <m.weber@alpha.example>").
 */
export function normaliseSenderAddress(senderAddress: string): string {
  return senderAddress.toLowerCase();
}

// R-15: five digits, with or without a prefix in front. The prefix is "A" or
// "a", with or without the hyphen: "A-10001", "a-10001", "A10001",
// "a10001", "10001". Nothing else, not even a space.
const LOOKUP_FORM = /^([Aa]-?)?\d{5}$/;

/**
 * R-15: the number to look up for one extracted order number, or null if it
 * is not a valid order number (R-16: „Keine gültige Auftragsnummer.“).
 * Every number in LOOKUP_FORM is looked up as "A-" plus its five digits.
 *
 * Limit: five digits without prefix are looked up even when the extraction
 * should not have extracted them (R-09, Stufe 3 instead of Stufe 2). Telling
 * the two apart needs the words around the number, which only the model
 * sees.
 */
export function normaliseOrderNumber(
  extractedOrderNumber: string,
): string | null {
  if (!LOOKUP_FORM.test(extractedOrderNumber)) return null;
  return `A-${extractedOrderNumber.slice(-5)}`;
}

// What the ERP answered to one lookup. "unreachable" stands for every way
// the ERP can fail to answer. As a value, not an exception: R-16 makes it an
// outcome of its own.
// Which failures are "unreachable" is decided in src/erp-client.ts; it
// reports their details to the entry point, never in this value, so they
// cannot reach the clerk (POLICY.md v1.8: an unusable answer counts as
// „nicht erreichbar“).
export type ErpAnswer<T> =
  | { kind: "found"; erpRecord: T }
  | { kind: "not_found" }
  | { kind: "unreachable" };

// R-16: per looked-up number exactly one outcome. "refused" stands for
// „Kein Auftrag mit dieser Nummer für diesen Kunden.“, "invalid" for
// „Keine gültige Auftragsnummer.“ (normaliseOrderNumber returned null),
// "unreachable" for „Auftragsbestand nicht erreichbar.“. Only "order"
// carries order data; the other outcomes carry nothing about the order.
export type OrderOutcome =
  | { kind: "order"; order: Order }
  | { kind: "refused" }
  | { kind: "invalid" }
  | { kind: "unreachable" };

/**
 * R-16: the outcome of one order lookup for the asking customer (R-14).
 * Another customer's order and a missing order give the same outcome, so
 * that no answer reveals which order numbers exist.
 */
export function revealOrderOnlyToOwner(
  askingCustomerNumber: string,
  answer: ErpAnswer<Order>,
): OrderOutcome {
  switch (answer.kind) {
    case "found": {
      const isOwnOrder =
        answer.erpRecord.customerNumber === askingCustomerNumber;
      return isOwnOrder
        ? { kind: "order", order: answer.erpRecord }
        : { kind: "refused" };
    }
    case "not_found":
      return { kind: "refused" };
    case "unreachable":
      return { kind: "unreachable" };
  }
}

// What the ERP stage needs from an ERP: the two lookups (CLAUDE.md, ERP
// stage). The stage gets an Erp passed in instead of building one: the
// caller decides which ERP it talks to, and tests pass an in-memory fake.
// src/erp-client.ts implements it over HTTP; an entry point builds that
// client from ERP_BASE_URL (src/config.ts), for the mock or a real ERP.
export interface Erp {
  findCustomerBySender(address: string): Promise<ErpAnswer<Customer>>;
  getOrderStatus(orderNumber: string): Promise<ErpAnswer<Order>>;
}

// One extracted order number and its outcome. The number stays as the
// extraction wrote it (R-15, R-02).
export type OrderLookup = {
  extractedOrderNumber: string;
  outcome: OrderOutcome;
};

// The result of the ERP stage for one email. "unknown_sender" stands for
// „Absender ist keinem Kunden zugeordnet.“ and "unreachable" for
// „Auftragsbestand nicht erreichbar.“ (R-14); in both, nothing was looked
// up. "assigned" names the asking customer and holds one outcome per
// extracted order number, in the order the extraction listed them.
export type ErpStageResult =
  | { kind: "unknown_sender" }
  | { kind: "unreachable" }
  | { kind: "assigned"; customerNumber: string; orders: OrderLookup[] };

/**
 * The ERP stage (POLICY.md R-14 to R-16): finds the asking customer by the
 * sender address, then looks up every extracted order number and decides
 * what may be shown.
 *
 * Takes only the sender address and the extracted order numbers. Customer
 * numbers from the email are not an input, so they can't assign the sender
 * (R-14). Lookups that fail are outcomes, not exceptions.
 */
export async function runErpStage(
  input: { senderAddress: string; orderNumbers: string[] },
  erp: Erp,
): Promise<ErpStageResult> {
  // An ErpAnswer<Customer>: found (with the customer as erpRecord),
  // not_found or unreachable.
  const sender = await erp.findCustomerBySender(
    normaliseSenderAddress(input.senderAddress),
  );
  if (sender.kind === "not_found") return { kind: "unknown_sender" };
  if (sender.kind === "unreachable") return { kind: "unreachable" };

  const { customerNumber } = sender.erpRecord;

  const orders = await Promise.all(
    input.orderNumbers.map(
      async (extractedOrderNumber): Promise<OrderLookup> => {
        const normalisedOrderNumber =
          normaliseOrderNumber(extractedOrderNumber);
        if (normalisedOrderNumber === null) {
          return { extractedOrderNumber, outcome: { kind: "invalid" } };
        }

        const answer = await erp.getOrderStatus(normalisedOrderNumber);
        return {
          extractedOrderNumber,
          outcome: revealOrderOnlyToOwner(customerNumber, answer),
        };
      },
    ),
  );
  return { kind: "assigned", customerNumber, orders };
}
