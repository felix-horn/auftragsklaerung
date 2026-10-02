import { readFileSync } from "node:fs";
import { z } from "zod";

// Reads one exported eval (npx promptfoo export eval <id> -o <file>.json)
// and prints, for an eval run with --repeat:
// 1. every check (one of the eight results for one email) that was not
//    right in all runs, with the answers it saw;
// 2. the totals of each run, and of all runs together.
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
        testCase: z.object({ description: z.string() }),
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
