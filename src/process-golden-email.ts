// Module 4.7: one golden email through the whole pipeline (processEmail),
// as if sent from the address typed in, against whatever answers at
// ERP_BASE_URL (.env). One API call, about half a US cent.
//
// Start the mock ERP first, in a second terminal:  npm run erp
// Then, for example:
//   npm run process:golden-email -- E-06 einkauf@kessler-fluidtechnik.example
//
// The golden set has no sender addresses (CLAUDE.md, ERP stage, Test
// data), so the address is typed in: the bare address, because the
// customer is found by the sender address alone (R-14). The lookup day is
// today in Germany. A lookup that ends as "unreachable" prints its problem
// for developers on stderr, before the result.

import "dotenv/config";
import { goldenCases } from "../evals/golden/cases.js";
import { toCalendarDateInGermany } from "./calendar-date.js";
import { loadConfig } from "./config.js";
import { createErpClient, describeErpProblem } from "./erp-client.js";
import type { ErpStageResult } from "./erp-stage.js";
import { extractEmail } from "./extract.js";
import { outcomeTexts } from "./outcome-texts.js";
import { processEmail } from "./process-email.js";

const config = loadConfig();

// process is Node's global (no import).
// argv[0] is the path to node,
// argv[1] the path to this file;
// the typed-in arguments start at index 2.
const [goldenCaseId, senderEmailAddress, ...extraArguments] =
  process.argv.slice(2);
if (
  goldenCaseId === undefined ||
  senderEmailAddress === undefined ||
  extraArguments.length > 0
) {
  console.error(
    "Usage: npm run process:golden-email -- <golden case id> <sender address>",
  );
  console.error(
    "Example: npm run process:golden-email -- E-06 einkauf@kessler-fluidtechnik.example",
  );
  // Exit code 1: npm and the shell see the run as failed.
  process.exit(1);
}
const goldenCase = goldenCases.find(
  ({ id }) => id === goldenCaseId,
);
if (goldenCase === undefined) {
  const knownIds = goldenCases.map((knownCase) => knownCase.id).join(", ");
  console.error(`No golden case ${goldenCaseId}. Known: ${knownIds}`);
  process.exit(1);
}

const erp = createErpClient({
  baseUrl: config.erpBaseUrl,
  reportProblem: (problem) => console.error(describeErpProblem(problem)),
});
// The day of the lookup, which decides whether a promise is overdue (R-17):
// read from the clock here, once, and passed in.
const lookupDate = toCalendarDateInGermany(new Date());

// A failed extraction throws (NoObjectGeneratedError, NoOutputGeneratedError,
// or an API error such as a missing key). Nothing catches it here: Node
// prints the error with its fields, the raw answer text included, and exits
// with code 1.
const {
  extraction,
  extractionUsage,
  messageUrgency,
  erpStageResult,
  urgencyAfterLookup,
} = await processEmail(
  { emailText: goldenCase.email, senderEmailAddress, lookupDate },
  { extractEmail, erp },
);

console.log(`${goldenCase.id} from ${senderEmailAddress}, lookup day ${lookupDate}`);
console.log(`ERP at ${config.erpBaseUrl}`);
console.log("");
// In the order the pipeline runs: extraction, urgency of the message,
// ERP lookup, urgency after the lookup.
console.log(
  `1. Extraction (${extractionUsage.inputTokens} input tokens, ${extractionUsage.outputTokens} output tokens including thinking):`,
);
console.log(JSON.stringify(extraction, null, 2));
console.log("");
console.log(`2. Urgency of the message (R-13): ${messageUrgency}`);
console.log("");
console.log("3. ERP lookup (R-14 to R-16):");
for (const line of describeErpStageResult(erpStageResult)) {
  console.log(`  ${line}`);
}
console.log("");
console.log(`4. Urgency after the lookup (R-17): ${urgencyAfterLookup}`);
// The lookup can only raise the urgency, never lower it (R-17).
console.log(
  urgencyAfterLookup === messageUrgency
    ? "   unchanged by the lookup"
    : `   raised by the lookup from ${messageUrgency} to ${urgencyAfterLookup}`,
);

// One line for the sender, then one per extracted order number: the
// order's fields as the ERP sent them, or POLICY.md's text for the outcome.
function describeErpStageResult(result: ErpStageResult): string[] {
  if (result.kind !== "assigned") {
    return [`Sender: ${outcomeTexts[result.kind]}`];
  }
  const lines = [`Sender: customer ${result.customerNumber}`];
  if (result.orders.length === 0) {
    lines.push("No order number extracted, nothing looked up.");
  }
  for (const { extractedOrderNumber, outcome } of result.orders) {
    if (outcome.kind === "order") {
      const { status, promisedDeliveryDate, shippedOn } = outcome.order;
      lines.push(
        `${extractedOrderNumber}: status ${status}, promisedDeliveryDate ${promisedDeliveryDate}, shippedOn ${shippedOn}`,
      );
    } else {
      lines.push(`${extractedOrderNumber}: ${outcomeTexts[outcome.kind]}`);
    }
  }
  return lines;
}
