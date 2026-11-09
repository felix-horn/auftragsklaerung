import type { LanguageModelUsage } from "ai";
import { type Erp, type ErpStageResult, runErpStage } from "./erp-stage.js";
import type { EmailExtraction } from "./schema.js";
import {
  deriveMessageUrgency,
  deriveUrgencyAfterLookup,
  type Urgency,
} from "./urgency.js";

// The pipeline for one email (CLAUDE.md, Pipeline (Module 4.7)): the
// model's extraction, the urgency of the message, the ERP lookup, and the
// urgency after the lookup.

// The model request: one email text in, the extraction and the request's
// token usage out. extractEmail in src/extract.ts has this shape; tests
// pass a fake.
export type ExtractEmail = (
  emailText: string,
) => Promise<{ output: EmailExtraction; usage: LanguageModelUsage }>;

// The result for one email. Both urgencies are kept: order data can raise
// the urgency, and the urgency of the message alone stays valid next to
// the raised one (R-17).
export type ProcessedEmail = {
  // What the model recorded from the text. The ERP stage changes nothing
  // in it (POLICY.md, Abgleich mit dem Auftragsbestand).
  extraction: EmailExtraction;
  // Tokens of the extraction request; output tokens include thinking.
  extractionUsage: LanguageModelUsage;
  // The urgency of the message alone: from its escalation signals and its
  // stated deadline, nothing else (R-13).
  messageUrgency: Urgency;
  // The ERP lookup: the asking customer, found by the sender address
  // (R-14); if found, for each extracted order number (R-15) the order's
  // data or the reason it is not shown, e.g. another customer's order
  // (R-16). Kept apart from the extraction.
  erpStageResult: ErpStageResult;
  // messageUrgency, raised to at least medium when a shown order's promised
  // delivery date has passed by the lookup day without delivery, or when
  // the email cancels an order not shipped yet (R-17).
  urgencyAfterLookup: Urgency;
};

/**
 * The pipeline for one email, one step after the other:
 * 1. the extraction: one model request;
 * 2. the urgency of the message alone, from escalation signals and a
 *    stated deadline (R-13);
 * 3. the ERP lookup: the customer found by the sender address (R-14), the
 *    extracted order numbers looked up (R-15), only that customer's orders
 *    shown (R-16);
 * 4. the urgency after the lookup: raised by an overdue promise or a
 *    cancellation before shipping (R-17).
 *
 * The model request and the ERP are passed in: an entry point passes
 * extractEmail (src/extract.ts) and the HTTP client (src/erp-client.ts),
 * tests pass fakes. The lookup day is passed in too, never read from the
 * clock.
 *
 * A failed extraction stops the pipeline: the error from extractEmail
 * comes through unchanged, NoObjectGeneratedError and
 * NoOutputGeneratedError included, and no ERP lookup runs. Lookups that
 * fail are outcomes in erpStageResult, not exceptions (runErpStage).
 */
export async function processEmail(
  input: { emailText: string; senderEmailAddress: string; lookupDate: string },
  dependencies: { extractEmail: ExtractEmail; erp: Erp },
): Promise<ProcessedEmail> {
  const { emailText, senderEmailAddress, lookupDate } = input;
  const { extractEmail, erp } = dependencies;

  const { output: extraction, usage: extractionUsage } =
    await extractEmail(emailText);
  const messageUrgency = deriveMessageUrgency(extraction);

  // The sender address and the extracted order numbers, nothing else:
  // customer numbers from the text never assign the sender (R-14).
  const erpStageResult = await runErpStage(
    { senderEmailAddress, orderNumbers: extraction.orderNumbers },
    erp,
  );

  const urgencyAfterLookup = deriveUrgencyAfterLookup({
    messageUrgency,
    intents: extraction.intents,
    erpStageResult,
    lookupDate,
  });

  return {
    extraction,
    extractionUsage,
    messageUrgency,
    erpStageResult,
    urgencyAfterLookup,
  };
}