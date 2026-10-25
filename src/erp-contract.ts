import { z } from "zod";
import {
  FindCustomerByEmail200Response,
  FindCustomerByEmail400Response,
  FindCustomerByEmail404Response,
  GetOrder200Response,
  GetOrder404Response,
} from "./generated/erp-api.js";

// The ERP's contract, under the names our code uses. The ERP team owns it:
// its source is their OpenAPI document, contracts/erp-api.json. orval
// generates the Zod schemas from it into src/generated/erp-api.ts
// (npm run erp:generate). Neither file is edited by hand: a new document
// from the ERP team replaces contracts/erp-api.json as a whole, then
// the schemas are generated again.
//
// The document describes an order as one object for every status: it does
// not tie shippedOn to the status. Code that needs both must not assume
// they agree.

// GET /customers?email=<address>, answer 200.
export const customerSchema = FindCustomerByEmail200Response;

// GET /orders/<orderNumber>, answer 200.
export const orderSchema = GetOrder200Response;

// GET /customers?email=<address>, answer 404: no customer has this
// address. The document allows exactly one text, so a 404 with any other
// body (a wrong base URL, another server's error page) fails this schema.
export const customerNotFoundSchema = FindCustomerByEmail404Response;

// GET /orders/<orderNumber>, answer 404: no order has this number. One
// allowed text, as above.
export const orderNotFoundSchema = GetOrder404Response;

// GET /customers without email, answer 400. Our client always sends an
// address; the mock's test checks that this answer, too, is documented.
export const missingEmailSchema = FindCustomerByEmail400Response;

export type Customer = z.infer<typeof customerSchema>;
export type Order = z.infer<typeof orderSchema>;
