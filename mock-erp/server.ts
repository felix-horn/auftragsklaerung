import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { MockErpData } from "./data-schema.js";

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
export function createMockErp(data: MockErpData): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/customers") {
      const email = url.searchParams.get("email");
      if (!email) {
        return respond(request, response, 400, {
          error: "query parameter email is required",
        });
      }
      // Exact comparison: "L.Vogt@…" does not find "l.vogt@…".
      const matchingCustomer = data.customers.find((customer) =>
        customer.contactEmails.includes(email),
      );
      if (!matchingCustomer) {
        return respond(request, response, 404, {
          error: "no customer with this contact address",
        });
      }
      return respond(request, response, 200, matchingCustomer);
    }

    // "/orders/A-44821" → "A-44821". Taken from the path as sent, without
    // percent-decoding: an order number has only letters, digits and "-".
    const orderPath = url.pathname.match(/^\/orders\/([^/]+)$/);
    if (request.method === "GET" && orderPath) {
      const requestedOrder = data.orders.find(
        (order) => order.orderNumber === orderPath[1],
      );
      if (!requestedOrder) {
        return respond(request, response, 404, {
          error: "no order with this number",
        });
      }
      return respond(request, response, 200, requestedOrder);
    }

    return respond(request, response, 404, { error: "no such endpoint" });
  });
}

// Sends status and JSON body, and prints one line per request to the
// terminal the mock ERP runs in.
function respond(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  body: unknown,
) {
  console.log(`${request.method} ${request.url} → ${status}`);
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}
