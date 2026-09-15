import { z } from "zod";

export const emailExtractionSchema = z.object({
  intents: z
    .array(
      z.object({
        type: z.enum([
          "order_status",
          "complaint",
          "new_inquiry",
          "invoice_question",
          "cancellation",
          "document_request",
          "spam",
          "other",
        ]),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe(
            "Confidence that this specific intent is present, 0 to 1. Judge each intent independently — these are not probabilities that sum to 1 across the array.",
          ),
      }),
    )
    .min(1)
    .describe(
      "All distinct intents present in this email, each with a self-assessed confidence from 0 to 1. Most emails have exactly one. Use multiple entries only when the email genuinely contains separate requests that would be handled by different people, and you are confident each one is actually present. Do not include an intent with a confidence below 0.5 — omit marginal or hedged intents entirely rather than listing them with low confidence. 'cancellation' means the customer wants an existing order cancelled or withdrawn, not a question about its status. 'document_request' means the customer is asking us to send or resend a document — an Auftragsbestätigung, catalogue, certificate, delivery note or a copy of an invoice. A request for a document is 'document_request' even when it concerns an invoice; 'invoice_question' is only for questions about the content or correctness of an invoice. 'other' means a genuine request that does not fit any category above, for example an administrative change such as updating stored master data. Use it only for real requests that fall outside the taxonomy, never as a hedge when unsure which category applies. It may appear alongside another intent when an email contains both a classifiable and an unclassifiable request. Never return an empty array.",
    ),

  orderNumbers: z
    .array(z.string())
    .describe(
      "All order numbers that could plausibly be the subject of this email. Empty array if none is present. Exactly one entry if the email refers unambiguously to a single order. Multiple entries only if it is genuinely unclear which order the customer means — do not include order numbers mentioned merely as background context when the actual subject is clear. Never include invoice numbers or other reference numbers that are not order numbers.",
    ),

  customerNumbers: z
    .array(z.string())
    .describe(
      "All customer numbers plausibly identifying the sender. Empty array if none is present. Never include invoice numbers, order numbers, or other reference numbers that are not customer numbers.",
    ),

  requestedAction: z
    .string()
    .nullable()
    .describe(
      "What the customer wants done, in a few words. Null if the email does not clearly request an action (e.g. spam, pure venting).",
    ),

  deadlineStated: z
    .string()
    .nullable()
    .describe(
      "A deadline by which the customer requires a response or resolution, quoted verbatim. Null if none is stated. Do not include requested or promised delivery dates. Do not include dates describing when something was expected in the past or has already occurred.",
    ),

  escalationSignals: z
    .array(
      z.enum([
        "repeat_contact",
        "threat_to_cancel",
        "production_halt",
        "legal_threat",
      ]),
    )
    .describe(
      "Escalation signals explicitly present in the text. 'repeat_contact' — the customer states they have contacted us before about this. 'threat_to_cancel' — threatens to cancel an order or end the business relationship. 'production_halt' — states their own operations are blocked or stopped. 'legal_threat' — mentions lawyers, legal action or formal claims. Empty array if none are present. Base this only on what the text explicitly says. Never infer from tone, punctuation, capitalisation or politeness.",
    ),
});

export type EmailExtraction = z.infer<typeof emailExtractionSchema>;
