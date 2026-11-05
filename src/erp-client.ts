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

// How long one lookup may take, from sending the request to the last byte
// of the answer. The mock ERP answers in a few milliseconds; an ERP that
// needs seconds is in trouble, and the email waits meanwhile. Retrying
// later is Module 7's job.
const DEFAULT_TIMEOUT_MILLISECONDS = 5000;

// Why a lookup gave no usable answer, for developers. The clerk only ever
// sees „Auftragsbestand nicht erreichbar.“ (POLICY.md v1.8).
// - no_connection: no answer at all (nothing listening, unknown host).
// - timeout: no complete answer within the timeout.
// - unexpected_status: a status the OpenAPI document doesn't list for
//   this lookup (500, 503, 401, …).
// - not_json: the body isn't JSON (an HTML error page, a login page).
// - breaks_contract: a 200 or 404 whose body fails the generated schema;
//   for a 404 that usually means a wrong ERP_BASE_URL.
export type ErpProblemKind =
  | "no_connection"
  | "timeout"
  | "unexpected_status"
  | "not_json"
  | "breaks_contract";

export type ErpProblem = {
  kind: ErpProblemKind;
  // "GET http://127.0.0.1:4100/orders/A-44821". The query of a customer
  // lookup holds the sender address; where such lines may be stored is
  // Module 9's decision.
  request: string;
  // The HTTP status, or null when no answer arrived.
  status: number | null;
  // The cause in one line: the network error's code, the content type,
  // or Zod's issues (field and what the contract expects). Never the
  // ERP's body: it holds customer data.
  detail: string;
};

export type ErpClientOptions = {
  // Config.erpBaseUrl, no trailing slash.
  baseUrl: string;
  // Called once for every lookup that ends as "unreachable". The entry
  // point decides where the problem goes (04_module/try-erp-client.ts
  // prints it); the client prints nothing, and the problem never travels
  // in the ErpAnswer, so it cannot reach the clerk.
  reportProblem: (problem: ErpProblem) => void;
  timeoutMilliseconds?: number;
};

/**
 * The ERP client: looks customers and orders up over HTTP.
 *
 * Only the answers the ERP's OpenAPI document lists count: 200 with a body
 * the contract accepts is "found", 404 with the documented body (one
 * allowed error text per operation) is "not_found". Everything else is
 * "unreachable" and is reported through reportProblem: no answer, no
 * answer in time, another status, a body that isn't JSON, a body that
 * breaks the contract (including a 404 with another body, such as the mock
 * ERP's "no such endpoint" for a wrong base URL). A reply that says nothing
 * reliable about the customer or order must never look like a missing one
 * (POLICY.md R-14, R-16).
 */
export function createErpClient({
  baseUrl,
  reportProblem,
  timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
}: ErpClientOptions): Erp {
  const lookUpWith = <T>(
    url: string,
    erpRecordSchema: z.ZodType<T>,
    notFoundSchema: z.ZodType,
  ) =>
    lookUp(url, erpRecordSchema, notFoundSchema, {
      reportProblem,
      timeoutMilliseconds,
    });

  return {
    findCustomerByEmailAddress: (senderEmailAddress) => {
      // "email" is the ERP's name for the query parameter. URLSearchParams
      // encodes "@" and "+": unencoded, a "+" in an address arrives at the
      // ERP as a space.
      const query = new URLSearchParams({ email: senderEmailAddress });
      return lookUpWith<Customer>(
        `${baseUrl}/customers?${query}`,
        customerSchema,
        customerNotFoundSchema,
      );
    },
    getOrderStatus: (orderNumber) =>
      lookUpWith<Order>(
        `${baseUrl}/orders/${encodeURIComponent(orderNumber)}`,
        orderSchema,
        orderNotFoundSchema,
      ),
  };
}

/**
 * One line for a developer's log, e.g.
 * "ERP lookup unusable (breaks_contract): GET http://…/orders/A-10001 → 200:
 * status: Invalid option: expected one of …".
 */
export function describeErpProblem(problem: ErpProblem): string {
  const { kind, request, status, detail } = problem;
  const answer = status === null ? "no answer" : `${status}`;
  return `ERP lookup unusable (${kind}): ${request} → ${answer}: ${detail}`;
}

// One GET, translated into an ErpAnswer. Every way to "unreachable" goes
// through reportProblem first.
async function lookUp<T>(
  url: string,
  erpRecordSchema: z.ZodType<T>,
  notFoundSchema: z.ZodType,
  settings: {
    reportProblem: (problem: ErpProblem) => void;
    timeoutMilliseconds: number;
  },
): Promise<ErpAnswer<T>> {
  const request = `GET ${url}`;
  const reportUnreachable = (
    kind: ErpProblemKind,
    status: number | null,
    detail: string,
  ): ErpAnswer<T> => {
    settings.reportProblem({ kind, request, status, detail });
    return { kind: "unreachable" };
  };
  const { timeoutMilliseconds } = settings;
  const timeoutDetail = `no complete answer within ${timeoutMilliseconds} ms`;

  // The signal ends the request after the timeout, also while the body is
  // still arriving.
  const signal = AbortSignal.timeout(timeoutMilliseconds);
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    return isTimeout(error)
      ? reportUnreachable("timeout", null, timeoutDetail)
      : reportUnreachable("no_connection", null, describeNetworkError(error));
  }

  const { status } = response;
  if (status !== 200 && status !== 404) {
    await response.body?.cancel();
    return reportUnreachable("unexpected_status", status, `status ${status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isTimeout(error)) {
      return reportUnreachable("timeout", status, timeoutDetail);
    }
    // Not error.message: for a body that isn't JSON it quotes the body.
    const contentType = response.headers.get("content-type") ?? "none";
    return reportUnreachable("not_json", status, `content type ${contentType}`);
  }

  if (status === 200) {
    const parsed = erpRecordSchema.safeParse(body);
    if (parsed.success) return { kind: "found", erpRecord: parsed.data };
    const issues = describeIssues(parsed.error);
    return reportUnreachable("breaks_contract", status, issues);
  }
  const parsed = notFoundSchema.safeParse(body);
  if (parsed.success) return { kind: "not_found" };
  const issues = describeIssues(parsed.error);
  const hint = "not the documented 404: is ERP_BASE_URL right?";
  return reportUnreachable("breaks_contract", status, `${issues} (${hint})`);
}

// AbortSignal.timeout ends fetch, and reading the body, with a
// DOMException named "TimeoutError".
function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

// fetch rejects with TypeError("fetch failed"); the cause holds the
// network error, e.g. code ECONNREFUSED (nothing listening) or ENOTFOUND
// (unknown host).
function describeNetworkError(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code;
    return typeof code === "string"
      ? `${code}: ${cause.message}`
      : cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}

// Zod's issues as "field: message", joined. Zod's messages name the field
// and what the contract expects, never the value that was sent.
function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`)
    .join("; ");
}
