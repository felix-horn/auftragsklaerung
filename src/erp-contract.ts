import { z } from "zod";
import {
  FindCustomerByEmail200Response,
  GetOrder200Response,
} from "./generated/erp-openapi.js";

// The ERP's contract, under the names our code uses. The ERP team owns it:
// its source is their OpenAPI document, contracts/erp-openapi.json. orval
// generates the Zod schemas from it into src/generated/erp-openapi.ts
// (npm run erp:generate). Neither file is edited by hand: a new document
// from the ERP team replaces contracts/erp-openapi.json as a whole, then
// the schemas are generated again.
//
// The document describes an order as one object for every status: it does
// not tie shippedOn to the status. Code that needs both must not assume
// they agree.
// TODO(Module 4.5): the ERP client checks every answer against
// customerSchema or orderSchema.

// GET /customers?email=<address>, answer 200.
export const customerSchema = FindCustomerByEmail200Response;

// GET /orders/<orderNumber>, answer 200.
export const orderSchema = GetOrder200Response;

export type Customer = z.infer<typeof customerSchema>;
export type Order = z.infer<typeof orderSchema>;
