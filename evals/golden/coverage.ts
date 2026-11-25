// Which golden emails exercise each situation of situations.ts, and which
// situations no email has yet. Also the intents and urgency the labels give.
// Run: npm run golden:coverage
import { emailExtractionSchema } from "../../src/schema.js";
import { goldenCases } from "./cases.js";
import { situations } from "./situations.js";

const emailsFor = (situation: string) =>
  goldenCases
    .filter((goldenCase) =>
      (goldenCase.exercises as readonly string[]).includes(situation),
    )
    .map((goldenCase) => goldenCase.id);

const withoutEmail = situations.filter(
  (situation) => emailsFor(situation).length === 0,
);

console.log(
  `Golden set coverage: ${situations.length} situations, ` +
    `${withoutEmail.length} without an email\n`,
);

console.log("Without an email:");
for (const situation of withoutEmail) console.log(`  ${situation}`);

console.log("\nBy situation (POLICY.md order):");
for (const situation of situations) {
  const emails = emailsFor(situation);
  console.log(`  ${situation}`);
  console.log(`    ${emails.length === 0 ? "none" : emails.join(", ")}`);
}

console.log("\nBy email:");
for (const goldenCase of goldenCases) {
  console.log(`  ${goldenCase.id}`);
  for (const situation of goldenCase.exercises) console.log(`    ${situation}`);
}

// Intents and urgency come from the labels, so unlabelled cases are left out.
const labelled = goldenCases.filter((goldenCase) => goldenCase.labels !== null);
const unlabelled = goldenCases.length - labelled.length;
const intentTypes =
  emailExtractionSchema.shape.intents.element.shape.type.options;

console.log(
  `\nIntents (${labelled.length} labelled emails` +
    `${unlabelled > 0 ? `, ${unlabelled} not yet labelled` : ""}):`,
);
for (const intent of intentTypes) {
  const emails = labelled
    .filter((goldenCase) => goldenCase.labels?.intents.includes(intent))
    .map((goldenCase) => goldenCase.id);
  console.log(`  ${intent.padEnd(18)}${emails.join(", ") || "none"}`);
}

console.log("\nUrgency:");
for (const urgency of ["high", "medium", "low"] as const) {
  const emails = labelled
    .filter((goldenCase) => goldenCase.labels?.urgency === urgency)
    .map((goldenCase) => goldenCase.id);
  console.log(`  ${urgency.padEnd(8)}${emails.join(", ") || "none"}`);
}
