import type { z } from "zod";
import {
  type Customer,
  customerSchema,
  errorBodySchema,
  type Order,
  orderSchema,
} from "./erp-contract.js";
import type { Erp, ErpAnswer } from "./erp-stage.js";

// The ERP over HTTP: the Erp interface (src/erp-stage.ts) for a real ERP
// or the mock ERP, whichever answers at the base URL. It carries requests
// and translates answers into ErpAnswer; the rules R-14 to R-16 stay in
// src/erp-stage.ts. The ERP's paths and answers are those of its OpenAPI
// document, contracts/erp-api.json.

// The texts of the two documented 404 answers (the document's examples).
// A 404 with any other body is not "no such record": the mock ERP answers
// "no such endpoint" for a path it doesn't have, which is what a wrong base
// URL produces, and a real server answers with its own error page.
const NO_CUSTOMER = "no customer with this contact address";
const NO_ORDER = "no order with this number";

/**
 * The ERP client: looks customers and orders up over HTTP at baseUrl
 * (Config.erpBaseUrl, no trailing slash).
 *
 * Only the answers the ERP's OpenAPI document lists count: 200 with a body
 * the contract accepts is "found", 404 with the documented text is
 * "not_found". Everything else is "unreachable": a reply that says nothing
 * reliable about the record must never look like a missing customer or
 * order (POLICY.md R-14, R-16).
 */
export function createErpClient(baseUrl: string): Erp {
  return {
    findCustomerBySender(address) {
      // URLSearchParams encodes "@" and "+": unencoded, a "+" in an address
      // arrives at the ERP as a space.
      const query = new URLSearchParams({ email: address });
      return lookUp<Customer>(
        `${baseUrl}/customers?${query}`,
        customerSchema,
        NO_CUSTOMER,
      );
    },
    getOrderStatus(orderNumber) {
      return lookUp<Order>(
        `${baseUrl}/orders/${encodeURIComponent(orderNumber)}`,
        orderSchema,
        NO_ORDER,
      );
    },
  };
}

// One GET, translated into an ErpAnswer.
async function lookUp<T>(
  url: string,
  recordSchema: z.ZodType<T>,
  notFoundText: string,
): Promise<ErpAnswer<T>> {
  // TODO(Module 4.5): part 6 adds a timeout, and the details of every
  // "unreachable" for developers.
  try {
    const response = await fetch(url);
    const body: unknown = await response.json();
    if (response.status === 200) {
      const record = recordSchema.safeParse(body);
      if (record.success) return { kind: "found", record: record.data };
    }
    if (response.status === 404) {
      const error = errorBodySchema.safeParse(body);
      if (error.success && error.data.error === notFoundText) {
        return { kind: "not_found" };
      }
    }
    return { kind: "unreachable" };
  } catch {
    // No connection, or a body that isn't JSON.
    return { kind: "unreachable" };
  }
}
