import type { Order } from "./erp-contract.js";

// Rules of the ERP stage (POLICY.md R-14 to R-16; CLAUDE.md, ERP stage).
// They belong to our code, not to the ERP: the ERP compares addresses
// exactly, never adds "A-" and returns any order to any caller (CLAUDE.md,
// Mock ERP).

/**
 * R-14: the sender address in lower case, because upper and lower case
 * don't matter. The ERP stores contact addresses in lower case and compares
 * them exactly (src/erp-contract.ts).
 *
 * Expects the bare address ("m.weber@alpha.example"), not a header with a
 * display name ("Max Weber <m.weber@alpha.example>").
 */
export function senderAddressForLookup(senderAddress: string): string {
  return senderAddress.toLowerCase();
}

// R-15: five digits, with or without a prefix in front. The prefix is "A" or
// "a", with or without the hyphen: "A-10001", "a-10001", "A10001",
// "a10001", "10001". Nothing else, not even a space.
const LOOKUP_FORM = /^([Aa]-?)?\d{5}$/;

/**
 * R-15: the number to look up for one recorded order number, or null if it
 * is not a valid order number (R-16: „Keine gültige Auftragsnummer.“).
 * Every number in LOOKUP_FORM is looked up as "A-" plus its five digits.
 *
 * Limit: five digits without prefix are looked up even when the extraction
 * should not have recorded them (R-09, Stufe 3 instead of Stufe 2). Telling
 * the two apart needs the words around the number, which only the model
 * sees.
 */
export function orderNumberForLookup(recorded: string): string | null {
  if (!LOOKUP_FORM.test(recorded)) return null;
  return `A-${recorded.slice(-5)}`;
}

// What the ERP answered to one lookup. "unreachable" stands for every way
// the ERP can fail to answer. As a value, not an exception: R-16 makes it an
// outcome of its own.
// TODO(Module 4.5): the HTTP client decides which failures are "unreachable".
export type ErpAnswer<T> =
  | { kind: "found"; record: T }
  | { kind: "not_found" }
  | { kind: "unreachable" };

// R-16: per looked-up number exactly one outcome. "refused" stands for
// „Kein Auftrag mit dieser Nummer für diesen Kunden.“, "invalid" for
// „Keine gültige Auftragsnummer.“ (orderNumberForLookup returned null),
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
export function orderOutcome(
  askingCustomer: string,
  answer: ErpAnswer<Order>,
): OrderOutcome {
  switch (answer.kind) {
    case "found": {
      const isOwnOrder = answer.record.customerNumber === askingCustomer;
      return isOwnOrder
        ? { kind: "order", order: answer.record }
        : { kind: "refused" };
    }
    case "not_found":
      return { kind: "refused" };
    case "unreachable":
      return { kind: "unreachable" };
  }
}
