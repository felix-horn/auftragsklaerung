import type { z } from "zod";
import {
  type Customer,
  customerNotFoundSchema,
  customerSchema,
  type Order,
  orderNotFoundSchema,
  orderSchema,
} from "./erp-contract.js";
import type { Erp, ErpAnswer } from "./erp-stage.js";

// The ERP over HTTP: the Erp interface (src/erp-stage.ts) for a real ERP
// or the mock ERP, whichever answers at the base URL. It carries requests
// and translates answers into ErpAnswer; the rules R-14 to R-16 stay in
// src/erp-stage.ts. The ERP's paths and answers are those of its OpenAPI
// document, contracts/erp-api.json.

/**
 * The ERP client: looks customers and orders up over HTTP at baseUrl
 * (Config.erpBaseUrl, no trailing slash).
 *
 * Only the answers the ERP's OpenAPI document lists count: 200 with a body
 * the contract accepts is "found", 404 with the documented body (one
 * allowed error text per operation) is "not_found". Everything else is
 * "unreachable", including a 404 with another body: the mock ERP's "no such
 * endpoint" for a wrong base URL, or a real server's own error page. A
 * reply that says nothing reliable about the customer or order must never
 * look like a missing one (POLICY.md R-14, R-16).
 */
export function createErpClient(baseUrl: string): Erp {
  return {
    findCustomerBySender(emailAddressSender) {
      // URLSearchParams encodes "@" and "+":
      // unencoded, a "+" in an address arrives at the ERP as a space.
      const query = new URLSearchParams({ email: emailAddressSender });
      return lookUp<Customer>(
        `${baseUrl}/customers?${query}`,
        customerSchema,
        customerNotFoundSchema,
      );
    },
    getOrderStatus(orderNumber) {
      return lookUp<Order>(
        `${baseUrl}/orders/${encodeURIComponent(orderNumber)}`,
        orderSchema,
        orderNotFoundSchema,
      );
    },
  };
}

// One GET, translated into an ErpAnswer.
async function lookUp<T>(
  url: string,
  erpRecordSchema: z.ZodType<T>,
  notFoundSchema: z.ZodType,
): Promise<ErpAnswer<T>> {
  // TODO(Module 4.5): part 6 adds a timeout, and the details of every
  // "unreachable" for developers.
  try {
    const response = await fetch(url);
    const body: unknown = await response.json();
    if (response.status === 200) {
      const parsed = erpRecordSchema.safeParse(body);
      if (parsed.success) return { kind: "found", erpRecord: parsed.data };
    }
    if (response.status === 404 && notFoundSchema.safeParse(body).success) {
      return { kind: "not_found" };
    }
    return { kind: "unreachable" };
  } catch {
    // No connection, or a body that isn't JSON.
    return { kind: "unreachable" };
  }
}
