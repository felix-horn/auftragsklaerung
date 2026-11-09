import type { Order } from "./erp-contract.js";
import type { ErpStageResult } from "./erp-stage.js";
import type { EmailExtraction } from "./schema.js";

export type Urgency = "low" | "medium" | "high";

// The urgency of the message alone (R-13). Reads only escalation signals and
// deadline, so it accepts anything that has those two fields: the model's
// full output or a golden label.
export function deriveMessageUrgency(
  input: Pick<EmailExtraction, "escalationSignals" | "deadlineStated">,
): Urgency {
  const { escalationSignals, deadlineStated } = input;
  if (
    escalationSignals.includes("production_halt") ||
    escalationSignals.includes("legal_threat") ||
    escalationSignals.includes("threat_to_cancel")
  ) {
    return "high";
  }
  if (deadlineStated !== null || escalationSignals.includes("repeat_contact")) {
    return "medium";
  }
  return "low";
}

/**
 * An overdue promise, the first case that raises the urgency after the
 * lookup (R-17): the order has a promised delivery date, the day of the
 * lookup is later than that date, and the order's status is not
 * "delivered". On the promised day itself the
 * promise has not passed yet (POLICY.md v1.9).
 *
 * Both dates are "YYYY-MM-DD" texts, the form the ERP sends. Year first and
 * fixed width make the texts sort like the dates they name, so `<` on the
 * texts compares the dates.
 */
export function isPromiseOverdue(order: Order, lookupDate: string): boolean {
  if (order.promisedDeliveryDate === null) return false;
  if (order.status === "delivered") return false;
  return order.promisedDeliveryDate < lookupDate;
}

/**
 * The urgency after the ERP lookup (R-17). The urgency of the message
 * (R-13) rises to medium when an order the lookup returned data for (outcome
 * "order") has an overdue promise (isPromiseOverdue), or is not shipped
 * yet and the message has the intent cancellation. High stays high; the
 * two cases together still give medium. Refused, invalid and unreachable
 * lookups, an unknown sender and an unreachable ERP raise nothing, because
 * there is no order data.
 *
 * "Not shipped yet" is the status "in_progress", whatever shippedOn says
 * (POLICY.md v1.9; the ERP's document does not tie the two).
 *
 * Returns the urgency after the lookup only. The urgency of the message
 * stays valid next to it, because it describes the message alone (R-17),
 * so the caller keeps both. The day of the lookup is passed in, never read
 * from the clock.
 */
export function deriveUrgencyAfterLookup(input: {
  messageUrgency: Urgency;
  intents: EmailExtraction["intents"];
  erpStageResult: ErpStageResult;
  lookupDate: string;
}): Urgency {
  const { messageUrgency, intents, erpStageResult, lookupDate } = input;
  if (erpStageResult.kind !== "assigned") return messageUrgency;

  const isCancellation = intents.some(
    (intent) => intent.type === "cancellation",
  );
  const ordersWithData = erpStageResult.orders.flatMap((lookup) =>
    lookup.outcome.kind === "order" ? [lookup.outcome.order] : [],
  );
  const isRaised = ordersWithData.some(
    (order) =>
      isPromiseOverdue(order, lookupDate) ||
      (isCancellation && order.status === "in_progress"),
  );

  // "mindestens mittel": low becomes medium, medium and high stay.
  return isRaised && messageUrgency === "low" ? "medium" : messageUrgency;
}
