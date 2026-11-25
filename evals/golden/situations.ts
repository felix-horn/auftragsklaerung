// Every situation of POLICY.md's Begriffe and R-01 to R-13 that a golden
// email can carry, in POLICY.md's order. A case lists the ones it was built for
// (`exercises` in cases.ts); `npm run golden:coverage` shows which emails
// exercise each situation and which situations no email has yet.
// A situation describes what the email contains, never its label, so
// `exercises` does not give the labeller the answer.
// New situations go here first, in the place of their rule.
export const situations = [
  "instructions to the system inside the message (Begriffe)",
  "something that suggests itself but isn't written (R-01)",
  "parts of the email not in German (R-02)",
  "a deadline in the customer's own words (R-02)",
  "a deadline in another language (R-02)",
  "an obvious sales pitch to us (R-03)",
  "a professional supplier offering us its products (R-03)",
  "a sender saying it already supplies companies in our industry (R-03)",
  "a first contact who wants to buy, without any number (R-03)",
  "two requests that don't depend on each other (R-04)",
  "a fact given as the reason for the request (R-04)",
  "a request to send an existing invoice or order document again (R-05)",
  "the content of an invoice questioned (R-05)",
  "the due date of an invoice questioned (R-05)",
  "a demand for a corrected invoice (R-05)",
  "a request stated plainly, „bitte …“ (R-06)",
  "a request phrased as a question (R-06)",
  "a request phrased as a wish or a need (R-06)",
  "an expectation stated as a condition (R-06)",
  "a problem described without any demand (R-06)",
  "a sales email with a call to action (R-07)",
  "an order the customer describes as finished (R-08)",
  "an order that appears only in a quoted older message (R-08)",
  "two orders, and the email doesn't say which one is meant (R-08)",
  "a number with prefix, named to match (R-09, Stufe 1)",
  "a number whose prefix contradicts how the customer names it (R-09, Stufe 1)",
  "a customer number without prefix, named as one (R-09, Stufe 2)",
  "an order number without prefix, named as one (R-09, Stufe 2)",
  "a number with neither prefix nor name (R-09, Stufe 3)",
  "an invoice number (R-09)",
  "a part number (R-09)",
  "earlier contact about the same matter (R-10)",
  "a production halt (R-10)",
  "a lawyer or legal steps (R-10)",
  "urgent tone: capitals, „dringend“, exclamation marks (R-10)",
  "a threat to end the business relationship (R-10)",
  "a cancellation announced in case something doesn't happen (R-11)",
  "a cancellation declared outright (R-11)",
  "a date by which the customer wants our answer (R-12)",
  "a date for something else: a wanted delivery, a planned order (R-12)",
  "a date of something that already happened (R-12)",
  "a date we promised (R-12)",
  "a signal of the top urgency tier (R-13)",
  "a top-tier signal together with lower ones (R-13)",
  "a deadline as the only signal (R-13)",
  "earlier contact as the only signal (R-13)",
  "earlier contact and a deadline, nothing of the top tier (R-13)",
] as const;

export type Situation = (typeof situations)[number];
