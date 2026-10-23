import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { ErpData } from "./data-schema.js";

// The mock ERP: answers like a company's order system would answer our
// service account. It serves whatever it is given and checks nothing about
// who is asking: matching the sender (R-14), adding "A-" (R-15) and refusing
// other customers' orders (R-16) are our code's job (src/erp-stage.ts).
//
// GET /customers?email=<address>  → 200 the customer with this contact address
//                                    404 no such address (exact match)
//                                    400 no email in the query
// GET /orders/<orderNumber>       → 200 the order
//                                    404 no such order
// anything else                   → 404 no such endpoint
//
// Started by mock-erp/main.ts (npm run erp). Exported as a function so that
// tests can start it with data of their own.
export function createMockErp(data: ErpData): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/customers") {
      const email = url.searchParams.get("email");
      if (!email) {
        return respond(req, res, 400, {
          error: "query parameter email is required",
        });
      }
      // Exact comparison: "L.Vogt@…" does not find "l.vogt@…".
      const customer = data.customers.find((c) =>
        c.contactEmails.includes(email),
      );
      if (!customer) {
        return respond(req, res, 404, {
          error: "no customer with this contact address",
        });
      }
      return respond(req, res, 200, customer);
    }

    // "/orders/A-44821" → "A-44821". Taken from the path as sent, without
    // percent-decoding: an order number has only letters, digits and "-".
    const orderPath = url.pathname.match(/^\/orders\/([^/]+)$/);
    if (req.method === "GET" && orderPath) {
      const order = data.orders.find((o) => o.orderNumber === orderPath[1]);
      if (!order) {
        return respond(req, res, 404, { error: "no order with this number" });
      }
      return respond(req, res, 200, order);
    }

    return respond(req, res, 404, { error: "no such endpoint" });
  });
}

// Sends status and JSON body, and prints one line per request to the
// terminal the mock ERP runs in.
function respond(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
) {
  console.log(`${req.method} ${req.url} → ${status}`);
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
