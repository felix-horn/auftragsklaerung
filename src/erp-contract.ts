import { z } from "zod";

// The contract between the mock ERP and our ERP client: what a customer and
// an order look like. One definition for both sides. The mock ERP checks
// its data file against erpDataSchema when it starts. Fields exist only
// where a step uses them (POLICY.md R-14 to R-17).
// TODO(Module 4.5): the ERP client checks every answer against
// customerSchema or orderSchema.

// R-09: "K-" or "A-" followed by five digits.
const customerNumber = z.string().regex(/^K-\d{5}$/);
const orderNumber = z.string().regex(/^A-\d{5}$/);

// A calendar date written YYYY-MM-DD, e.g. "2026-10-30". Zod also rejects
// dates that don't exist, such as "2026-02-30".
const date = z.iso.date();

// Stored in lower case. The mock ERP compares addresses exactly; ignoring
// upper and lower case (R-14) is our code's job, not the ERP's.
const contactEmail = z.email().lowercase("must be lower case");

export const customerSchema = z.object({
  customerNumber,
  contactEmails: z.array(contactEmail),
});

// The fields every order has, whatever its status. promisedDeliveryDate is
// null while no delivery date has been promised.
const orderFields = {
  orderNumber,
  customerNumber,
  promisedDeliveryDate: date.nullable(),
};

// One shape per status, so that status and shipping date cannot contradict
// each other: an order in progress has no shipping date, a shipped or
// delivered order always has one. Zod picks the shape by the "status" field.
export const orderSchema = z.discriminatedUnion("status", [
  z.object({
    ...orderFields,
    status: z.literal("in_progress"),
    shippedOn: z.null(),
  }),
  z.object({ ...orderFields, status: z.literal("shipped"), shippedOn: date }),
  z.object({ ...orderFields, status: z.literal("delivered"), shippedOn: date }),
]);

// The mock ERP's data file. On top of each record's own shape: no customer
// number, contact address or order number may appear twice, because a
// lookup by any of them must find at most one record.
export const erpDataSchema = z
  .object({
    customers: z.array(customerSchema),
    orders: z.array(orderSchema),
  })
  .superRefine((data, ctx) => {
    const checkUnique = (
      list: "customers" | "orders",
      what: string,
      values: string[],
    ) => {
      const seen = new Set<string>();
      for (const value of values) {
        if (seen.has(value)) {
          ctx.addIssue({
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
      data.customers.map((c) => c.customerNumber),
    );
    checkUnique(
      "customers",
      "contact address",
      data.customers.flatMap((c) => c.contactEmails),
    );
    checkUnique(
      "orders",
      "order number",
      data.orders.map((o) => o.orderNumber),
    );
  });

export type Customer = z.infer<typeof customerSchema>;
export type Order = z.infer<typeof orderSchema>;
export type ErpData = z.infer<typeof erpDataSchema>;
