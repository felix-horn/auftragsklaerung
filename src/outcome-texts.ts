import type { ErpStageResult, OrderOutcome } from "./erp-stage.js";

// The outcomes of the ERP stage that the clerk reads as a text: every kind
// except "assigned" (a customer number and one outcome per order) and
// "order" (the order's data). "unreachable" is a kind of both
// ErpStageResult (at the sender lookup, R-14) and OrderOutcome (at an
// order lookup, R-16); POLICY.md gives both the same text.
export type OutcomeWithText =
  | Exclude<ErpStageResult["kind"], "assigned">
  | Exclude<OrderOutcome["kind"], "order">;

// POLICY.md's texts for these outcomes, word for word: an unknown or
// unreachable sender from the rule on who is asking (R-14), a refused,
// invalid or unreachable order from the rule on what the sender's customer
// may see (R-16). The code works with the kinds; entry points, and later
// the approval queue, show these texts.
//
// The type makes tsc refuse this table when a kind has no text, so a new
// kind cannot reach the clerk without one. src/outcome-texts.test.ts checks
// that every text occurs in docs/POLICY.md as POLICY.md quotes it.
export const outcomeTexts: Record<OutcomeWithText, string> = {
  unknown_sender: "Absender ist keinem Kunden zugeordnet.",
  unreachable: "Auftragsbestand nicht erreichbar.",
  refused: "Kein Auftrag mit dieser Nummer für diesen Kunden.",
  invalid: "Keine gültige Auftragsnummer.",
};
