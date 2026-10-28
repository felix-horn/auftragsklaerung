import { z } from "zod";
import { customerSchema, orderSchema } from "../src/erp-contract.js";

// The mock ERP's data file, mock-erp/data.json. Every record must be what
// the ERP's contract promises (src/erp-contract.ts). On top of that, two
// rules that hold for this file but generate no check from the OpenAPI
// document:
// - Contact addresses are lower case. The document says so only in a
//   description ("stored in lower case"), which orval turns into
//   .describe() text, not into a check.
// - No customer number, contact address or order number appears twice,
//   because a lookup by any of them must find at most one record.
// The mock ERP refuses to start on a file that breaks them (main.ts).

const customerRecord = customerSchema.extend({
  contactEmails: z.array(z.email().lowercase("must be lower case")),
});

export const mockErpDataSchema = z
  .object({
    customers: z.array(customerRecord),
    orders: z.array(orderSchema),
  })
  .superRefine((data, context) => {
    const checkUnique = (
      list: "customers" | "orders",
      what: string,
      values: string[],
    ) => {
      const seen = new Set<string>();
      for (const value of values) {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            path: [list],
            message: `${what} ${value} appears more than once`,
          });
        }
        seen.add(value);
      }
    };
    checkUnique(
      "customers",
      "customer number",
      data.customers.map((customer) => customer.customerNumber),
    );
    checkUnique(
      "customers",
      "contact address",
      data.customers.flatMap((customer) => customer.contactEmails),
    );
    checkUnique(
      "orders",
      "order number",
      data.orders.map((order) => order.orderNumber),
    );
  });

export type MockErpData = z.infer<typeof mockErpDataSchema>;
