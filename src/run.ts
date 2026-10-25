import "dotenv/config";
import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { extractEmail } from "./extract.js";
import { deriveUrgency } from "./urgency.js";
import { goldenCases } from "../evals/golden/cases.js";

let failures = 0;

for (const { id, email } of goldenCases) {
  try {
    const { output, usage } = await extractEmail(email);
    console.log("Email text:", email);
    console.log("Returned `output` from `generateText`:", output);
    console.log("Returned `usage` from `generateText`:", usage);
    console.log("Derived urgency:", deriveUrgency(output));
  } catch (err) {
    failures++;
    if (NoObjectGeneratedError.isInstance(err)) {
      // model produced something, but it failed Zod validation against your schema
      console.error("Schema validation failed. Raw text:", err.text);
      console.error("Cause:", err.cause);
    } else if (NoOutputGeneratedError.isInstance(err)) {
      // model finished for a reason other than a normal stop (e.g. it tried to call a tool instead)
      console.error("No structured output was produced at all.");
    }
    console.error(`${id} failed extraction — see error above.`);
  }
  console.log("---");
}

console.log(
  `Completed: ${goldenCases.length - failures}/${goldenCases.length} extractions succeeded.`,
);
