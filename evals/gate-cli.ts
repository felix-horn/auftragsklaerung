import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  evalExportSchema,
  judge,
  type EvalExport,
  type Finding,
} from "./gate.js";

// Runs the gate (gate.ts) on one exported eval run against every export in
// evals/baseline/. No API calls.
// Usage: npm run eval:gate -- <export.json>
// Exit code: 0 green, 1 red, 2 no verdict (nothing was judged).

// npm scripts run in the repo root, so this path is relative to it.
const baselineDir = "evals/baseline";

function read(file: string): EvalExport {
  const parsed = evalExportSchema.safeParse(
    JSON.parse(readFileSync(file, "utf8")),
  );
  if (!parsed.success) {
    console.error(`${file} is not an export the gate can read:`);
    console.error(z.prettifyError(parsed.error));
    process.exit(2);
  }
  return parsed.data;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run eval:gate -- <export.json>");
  process.exit(2);
}
const baselineFiles = readdirSync(baselineDir)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => path.join(baselineDir, name));
if (baselineFiles.length === 0) {
  console.error(`No baseline export in ${baselineDir}/`);
  process.exit(2);
}

const baselines = baselineFiles.map(read);
const run = read(file);
const verdict = judge(baselines, run);

console.log(`Eval run: ${run.evalId}`);
console.log(`Baseline: ${baselineFiles.join(", ")}`);

if (verdict.outcome === "no verdict") {
  console.log("\nNO VERDICT: nothing was judged.");
  for (const reason of verdict.reasons) console.log(`  ${reason}`);
  process.exit(2);
}

// The checks that decide come first, marked with ✗. The known failures
// follow under their own heading, because they never change the result.
const line = (marker: string, f: Finding) =>
  `  ${marker} ${f.id}  ${f.check.padEnd(17)} right in ${f.baselineRight}/${f.baselineRuns} baseline runs: ${f.reason}`;

if (verdict.outcome === "red") {
  console.log(
    `\nRED: ${verdict.regressions.length} check(s) wrong that were right in every baseline run.`,
  );
  console.log("These decide the result:");
  for (const f of verdict.regressions) console.log(line("✗", f));
  process.exitCode = 1;
} else {
  console.log(
    "\nGREEN: every check that was right in every baseline run is right.",
  );
}

console.log(
  "\nAlso wrong, as in some or all baseline runs (expected, not deciding):",
);
console.log(
  verdict.known.length > 0
    ? verdict.known.map((f) => line(" ", f)).join("\n")
    : "  none",
);

if (verdict.outcome === "red") {
  console.log("\nA red run is a reason to look, not proof: see CLAUDE.md.");
}
