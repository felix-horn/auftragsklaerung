import { z } from "zod";

// The gate (Module 3.8): judges one eval run against the baseline.
// The baseline is every export of the unchanged pipeline in evals/baseline/,
// added up whatever the number of runs per file (which files: CLAUDE.md, CI).
// A check (one of the eight results for one email) that was right in every
// baseline run is guarded: if it is wrong in the eval run, the gate turns red.
// A check that was wrong in some or all baseline runs is listed, but never
// decides.
// Like report.ts, the gate grades nothing itself: pass/fail and the answers
// are what the assertions stored. gate-cli.ts reads the files and prints.

export const checks = [
  "schemaValid",
  "intents",
  "requestedAction",
  "orderNumbers",
  "customerNumbers",
  "escalationSignals",
  "deadlineStated",
  "urgency",
] as const;

// Only the parts of an export the gate reads. `promptfoo export eval` and
// `promptfoo eval -o` write the same shape.
const resultSchema = z.object({
  testIdx: z.number(),
  // promptfoo's codes: 0 = all checks passed, 1 = a check failed,
  // 2 = ERROR (no answer to check)
  failureReason: z.number(),
  error: z.string().nullish(),
  testCase: z.object({
    description: z.string(),
    vars: z.object({ email: z.string() }),
    metadata: z.object({ labels: z.unknown() }),
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
});
export const evalExportSchema = z.object({
  evalId: z.string(),
  results: z.object({ results: z.array(resultSchema) }),
});
export type EvalExport = z.infer<typeof evalExportSchema>;
type Result = EvalExport["results"]["results"][number];

// One wrong check in the eval run, with how often the baseline got it right.
// `reason` is the check's stored reason: "got <answer>, expected <label>".
export type Finding = {
  id: string;
  check: string;
  baselineRight: number;
  baselineRuns: number;
  reason: string;
};

export type Verdict =
  | { outcome: "no verdict"; reasons: string[] }
  | {
      outcome: "green" | "red";
      // Right in every baseline run, wrong now: these turn the gate red.
      regressions: Finding[];
      // Wrong in some or all baseline runs: listed, never deciding.
      known: Finding[];
    };

// Each email's results in run order. promptfoo numbers the results (testIdx)
// so that the repeats of one email follow each other, as in report.ts.
function byEmail(results: Result[]): Map<string, Result[]> {
  const emails = new Map<string, Result[]>();
  const sorted = [...results].sort((first, second) => first.testIdx - second.testIdx);
  for (const result of sorted) {
    const id = result.testCase.description;
    emails.set(id, [...(emails.get(id) ?? []), result]);
  }
  return emails;
}

function component(result: Result, check: string) {
  const found = result.gradingResult?.componentResults.find(
    (storedComponent) => storedComponent.assertion.metric === check,
  );
  if (!found) {
    throw new Error(
      `${result.testCase.description}: no stored result for ${check}`,
    );
  }
  return found;
}

// Email text and labels of one result, to compare eval run and baseline.
const gradedAgainst = (result: Result) =>
  JSON.stringify([result.testCase.vars.email, result.testCase.metadata.labels]);

export function judge(baselines: EvalExport[], run: EvalExport): Verdict {
  // 1. An ERROR has no answer, so its checks have no results: no verdict.
  const errors = [...baselines, run].flatMap((evalExport) =>
    evalExport.results.results
      .filter((result) => result.failureReason === 2)
      .map(
        (result) =>
          `${evalExport.evalId}: ${result.testCase.description} is an ERROR (${result.error ?? "no message"})`,
      ),
  );
  if (errors.length > 0) return { outcome: "no verdict", reasons: errors };

  // 2. The gate judges exactly one eval run.
  const runEmails = byEmail(run.results.results);
  const repeated = [...runEmails].filter(([, results]) => results.length !== 1);
  if (repeated.length > 0) {
    return {
      outcome: "no verdict",
      reasons: [
        `${run.evalId} has ${repeated[0][1].length} results for ${repeated[0][0]}: the gate judges one eval run. Compare repeated runs with the table in CLAUDE.md.`,
      ],
    };
  }

  // 3. Baseline and eval run must be graded against the same emails and
  //    labels. After a change to either, the baseline has to be run again.
  const reasons: string[] = [];
  for (const baseline of baselines) {
    const emails = byEmail(baseline.results.results);
    const missing = [...runEmails.keys()].filter((id) => !emails.has(id));
    const extra = [...emails.keys()].filter((id) => !runEmails.has(id));
    for (const id of missing)
      reasons.push(`${baseline.evalId}: no results for ${id}`);
    for (const id of extra)
      reasons.push(`${baseline.evalId}: ${id} is not in the eval run`);
    for (const [id, results] of emails) {
      const runResult = runEmails.get(id)?.[0];
      if (
        runResult &&
        results.some(
          (result) => gradedAgainst(result) !== gradedAgainst(runResult),
        )
      ) {
        reasons.push(
          `${baseline.evalId}: ${id} has a different email text or different labels than the eval run`,
        );
      }
    }
  }
  if (reasons.length > 0) return { outcome: "no verdict", reasons };

  // 4. How often each check was right, over all baseline files together.
  const right = new Map<string, number>();
  const runsOf = new Map<string, number>();
  for (const baseline of baselines) {
    for (const [id, results] of byEmail(baseline.results.results)) {
      runsOf.set(id, (runsOf.get(id) ?? 0) + results.length);
      for (const check of checks) {
        const key = `${id} ${check}`;
        const passes = results.filter(
          (result) => component(result, check).pass,
        ).length;
        right.set(key, (right.get(key) ?? 0) + passes);
      }
    }
  }

  // 5. Every wrong check in the eval run, sorted into the two lists.
  const regressions: Finding[] = [];
  const known: Finding[] = [];
  const ids = [...runEmails.keys()].sort();
  for (const id of ids) {
    const result = runEmails.get(id)![0];
    for (const check of checks) {
      const storedComponent = component(result, check);
      if (storedComponent.pass) continue;
      const finding: Finding = {
        id,
        check,
        baselineRight: right.get(`${id} ${check}`) ?? 0,
        baselineRuns: runsOf.get(id) ?? 0,
        reason: storedComponent.reason,
      };
      if (finding.baselineRight === finding.baselineRuns)
        regressions.push(finding);
      else known.push(finding);
    }
  }
  return {
    outcome: regressions.length > 0 ? "red" : "green",
    regressions,
    known,
  };
}
