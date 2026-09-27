import type { EmailExtraction } from "./schema.js";

export type Urgency = "low" | "medium" | "high";

// R-13. Reads only escalation signals and deadline, so it accepts anything that has
// those two fields: the model's full output or a golden label.
export function deriveUrgency(
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
