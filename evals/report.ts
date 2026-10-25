import { readFileSync } from "node:fs";
import { z } from "zod";
import { emailExtractionSchema, type EmailExtraction } from "../src/schema.js";
import { goldenLabelsSchema } from "./golden/case-schema.js";

// Reads one exported eval (npx promptfoo export eval <id> -o <file>.json)
// and prints, for an eval run with --repeat:
// 1. every check (one of the eight results for one email) that was not
//    right in all runs, with the answers it saw;
// 2. the totals of each run, and of all runs together;
// 3. the confidence of every intent the model reported, next to the label.
// It grades nothing itself: pass/fail and the answers are what the
// assertions stored in the eval. Not loaded by promptfoo; no API calls.
// Usage: npm run eval:report -- <export.json>

// Only the parts of the export this script reads.
const exportSchema = z.object({
  evalId: z.string(),
  results: z.object({
    results: z.array(
      z.object({
        testIdx: z.number(),
        // promptfoo's codes: 0 = all checks passed, 1 = a check failed,
        // 2 = ERROR (no answer to check)
        failureReason: z.number(),
        testCase: z.object({
          description: z.string(),
          metadata: z.object({ labels: goldenLabelsSchema }),
        }),
        gradingResult: z
          .object({
            componentResults: z.array(
              z.object({
                assertion: z.object({ metric: z.string() }),
                pass: z.boolean(),
                reason: z.string(),
              }),
            ),
          })
          .nullish(),
        // The model's answer as the provider passed it on. Section 3 parses
        // it with the extraction schema to read the confidences.
        response: z.object({ output: z.unknown().optional() }).nullish(),
      }),
    ),
  }),
});
type Result = z.infer<typeof exportSchema>["results"]["results"][number];

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run eval:report -- <export.json>");
  process.exit(1);
}
const parsed = exportSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error(`${file} is not an export this report can read:`);
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}
const data = parsed.data;

// The rule from CLAUDE.md (Eval assertions): numbers only from an eval
// without ERRORs. An ERROR has no answer, so its checks have no results.
const errors = data.results.results.filter((r) => r.failureReason === 2);
if (errors.length > 0) {
  console.error(
    `${data.evalId} has ${errors.length} ERROR(s). Re-run the whole eval.`,
  );
  process.exit(1);
}

// promptfoo numbers the results (testIdx) so that the repeats of one email
// follow each other: E-01 run 1 … run 10, then E-02 run 1 … run 10, …
// Sorted by testIdx, each email's results are therefore in run order.
const sorted = [...data.results.results].sort((a, b) => a.testIdx - b.testIdx);
const ids = [...new Set(sorted.map((r) => r.testCase.description))].sort();
const runsOf = (id: string) =>
  sorted.filter((r) => r.testCase.description === id);
const runs = runsOf(ids[0]).length;
for (const id of ids) {
  if (runsOf(id).length !== runs) {
    throw new Error(`${id}: ${runsOf(id).length} results, not ${runs}`);
  }
}

// The checks in the order of the config. schemaValid is not a field, so the
// field totals leave it out (22 × 7 = 154, as in CLAUDE.md).
const fields = [
  "intents",
  "requestedAction",
  "orderNumbers",
  "customerNumbers",
  "escalationSignals",
  "deadlineStated",
  "urgency",
];
const checks = ["schemaValid", ...fields];

// What the check saw: the part of its reason before ", expected".
// Lists are sorted, because the checks ignore order. requestedAction is
// compared only as present or null, so its wording is not shown.
function answerSeen(check: string, reason: string): string {
  const seen = /^got (.*), expected /.exec(reason)?.[1] ?? reason;
  if (check === "requestedAction") {
    return seen === "null" ? "null" : "an action";
  }
  if (seen.startsWith("[")) return JSON.stringify(JSON.parse(seen).sort());
  return seen;
}

function checkResult(r: Result, check: string) {
  const c = r.gradingResult?.componentResults.find(
    (c) => c.assertion.metric === check,
  );
  if (!c) {
    throw new Error(`${r.testCase.description}: no stored result for ${check}`);
  }
  return { pass: c.pass, seen: answerSeen(check, c.reason) };
}

// ["[] 6×", …]: each different answer with how often it came, most often first.
function tally(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v} ${n}×`)
    .join(", ");
}

console.log(`${data.evalId}: ${ids.length} emails, ${runs} run(s) each\n`);

// 1. Every check that was not right in all runs.
const sometimes: string[] = [];
const never: string[] = [];
let always = 0;
for (const id of ids) {
  for (const check of checks) {
    const results = runsOf(id).map((r) => checkResult(r, check));
    const right = results.filter((r) => r.pass).length;
    const line = `${id}  ${check.padEnd(17)} ${String(right).padStart(2)}/${runs}  ${tally(results.map((r) => r.seen))}`;
    if (right === runs) always++;
    else if (right === 0) never.push(line);
    else sometimes.push(line);
  }
}
console.log("Right in some runs, wrong in others (right/runs, answers seen):");
console.log(sometimes.length > 0 ? sometimes.join("\n") : "none");
console.log("\nWrong in every run:");
console.log(never.length > 0 ? never.join("\n") : "none");
console.log(
  `\nRight in every run: ${always} of ${ids.length * checks.length} checks\n`,
);

// 2. Totals per run: run k is the k-th result of every email.
const cell = (v: number) => String(v).padStart(4);
const label = (text: string) => text.padEnd(18);
const perRun = Array.from({ length: runs }, (_, k) => {
  const results = ids.map((id) => runsOf(id)[k]);
  const fieldsRight = results
    .flatMap((r) => fields.map((f) => checkResult(r, f).pass))
    .filter(Boolean).length;
  const emailsRight = results.filter((r) => r.failureReason === 0).length;
  return { fieldsRight, emailsRight };
});
console.log(`${label("run")}${perRun.map((_, k) => cell(k + 1)).join("")}`);
console.log(
  `${label(`fields right/${ids.length * fields.length}`)}${perRun.map((r) => cell(r.fieldsRight)).join("")}`,
);
console.log(
  `${label(`emails right/${ids.length}`)}${perRun.map((r) => cell(r.emailsRight)).join("")}`,
);

// All runs together: must equal the boxes in promptfoo view.
console.log("\nAll runs together (compare with the boxes in the view):");
for (const check of checks) {
  const right = sorted.filter((r) => checkResult(r, check).pass).length;
  console.log(`  ${check.padEnd(17)} ${right}/${sorted.length}`);
}

// 3. The confidence of every intent the model reported, next to the label.
// One row per email and intent type: is the type in the label, in how many
// runs did the model report it, and with which confidences. Labelled types
// start with an empty list, so an intent the model never reported shows up.
type IntentType = EmailExtraction["intents"][number]["type"];
type IntentRow = {
  id: string;
  type: IntentType;
  isInLabel: boolean;
  confidences: number[];
};
const intentRows: IntentRow[] = [];
for (const id of ids) {
  const results = runsOf(id);
  const labelled = results[0].testCase.metadata.labels.intents;
  const confidences = new Map<IntentType, number[]>(
    labelled.map((type) => [type, []]),
  );
  for (const r of results) {
    const answer = emailExtractionSchema.safeParse(r.response?.output);
    if (!answer.success) continue; // no valid extraction: no confidences
    for (const intent of answer.data.intents) {
      const seen = confidences.get(intent.type) ?? [];
      confidences.set(intent.type, [...seen, intent.confidence]);
    }
  }
  for (const [type, values] of confidences) {
    intentRows.push({
      id,
      type,
      isInLabel: labelled.includes(type),
      confidences: values,
    });
  }
}
const lowest = (row: IntentRow) =>
  row.confidences.length > 0 ? Math.min(...row.confidences) : -1;
intentRows.sort((a, b) => lowest(a) - lowest(b) || a.id.localeCompare(b.id));

console.log("\nIntents the model reported, lowest confidence first:");
console.log("email intent             in label  reported  confidence");
for (const row of intentRows) {
  const low = Math.min(...row.confidences).toFixed(2);
  const high = Math.max(...row.confidences).toFixed(2);
  const range =
    row.confidences.length === 0 ? "-" : low === high ? low : `${low}–${high}`;
  const reported = `${row.confidences.length}/${runs}`;
  console.log(
    `${row.id}  ${row.type.padEnd(18)} ${(row.isInLabel ? "yes" : "NO").padEnd(9)} ${reported.padEnd(9)} ${range}`,
  );
}

// The same reports grouped by confidence. "emails" counts the different
// emails behind a group: ten runs of one email are not ten new cases.
const groups = [
  { name: "below 0.5", from: 0, to: 0.5 },
  { name: "0.5–0.59", from: 0.5, to: 0.6 },
  { name: "0.6–0.69", from: 0.6, to: 0.7 },
  { name: "0.7–0.79", from: 0.7, to: 0.8 },
  { name: "0.8–0.89", from: 0.8, to: 0.9 },
  { name: "0.9–1.0", from: 0.9, to: 1.01 },
];
console.log("\nconfidence  reports  in label  emails");
for (const group of groups) {
  // One entry per report in this group, each carrying the row it came from.
  const reports = intentRows.flatMap((row) =>
    row.confidences
      .filter((c) => c >= group.from && c < group.to)
      .map(() => row),
  );
  const inLabel = reports.filter((row) => row.isInLabel).length;
  const emails = new Set(reports.map((row) => row.id)).size;
  console.log(
    `${group.name.padEnd(11)} ${String(reports.length).padStart(7)}  ${String(inLabel).padStart(8)}  ${String(emails).padStart(6)}`,
  );
}
