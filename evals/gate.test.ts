import { expect, test } from "vitest";
import { checks, judge, type EvalExport } from "./gate.js";

// All emails, labels and answers below are invented. None is copied from the
// golden set.

const emails = {
  "E-91": "Wo bleibt Bestellung A-10001?",
  "E-92": "Bitte senden Sie den Katalog.",
};
const labels = { intents: ["order_status"], orderNumbers: ["A-10001"] };

// An export with `runs` runs of each invented email. `wrong` names the checks
// that failed, per run: wrong[k] = ["E-91 intents"] makes E-91's intents
// wrong in run k. "E-91 ERROR" makes that result an ERROR.
function evalExport(
  evalId: string,
  runs: number,
  wrong: string[][] = [],
  labelsOf: Record<string, unknown> = {},
): EvalExport {
  const ids = Object.keys(emails) as (keyof typeof emails)[];
  const results = ids.flatMap((id, emailIndex) =>
    Array.from({ length: runs }, (_, k) => {
      const failing = wrong[k] ?? [];
      const testCase = {
        description: id,
        vars: { email: emails[id] },
        metadata: { labels: labelsOf[id] ?? labels },
      };
      const testIdx = emailIndex * runs + k;
      if (failing.includes(`${id} ERROR`)) {
        return { testIdx, failureReason: 2, error: "Overloaded", testCase };
      }
      const componentResults = checks.map((check) => {
        const hasPassed = !failing.includes(`${id} ${check}`);
        return {
          assertion: { metric: check },
          pass: hasPassed,
          reason: hasPassed ? "got [], expected []" : 'got ["other"], expected []',
        };
      });
      const failureReason = componentResults.every((c) => c.pass) ? 0 : 1;
      return {
        testIdx,
        failureReason,
        testCase,
        gradingResult: { componentResults },
      };
    }),
  );
  return { evalId, results: { results } };
}

// A baseline of ten runs: E-91 intents wobbles (wrong in runs 3 and 7),
// E-92 orderNumbers is wrong in every run, everything else is always right.
const tenRuns = Array.from({ length: 10 }, (_, k) => [
  "E-92 orderNumbers",
  ...(k === 3 || k === 7 ? ["E-91 intents"] : []),
]);
const baseline = evalExport("baseline", 10, tenRuns);

test("green: nothing wrong", () => {
  const verdict = judge([baseline], evalExport("run", 1));
  expect(verdict).toEqual({ outcome: "green", regressions: [], known: [] });
});

test("green: a check wrong in some or all baseline runs is wrong", () => {
  const run = evalExport("run", 1, [["E-91 intents", "E-92 orderNumbers"]]);
  const verdict = judge([baseline], run);
  expect(verdict.outcome).toBe("green");
  if (verdict.outcome === "no verdict") return;
  expect(
    verdict.known.map(
      (f) => `${f.id} ${f.check} ${f.baselineRight}/${f.baselineRuns}`,
    ),
  ).toEqual(["E-91 intents 8/10", "E-92 orderNumbers 0/10"]);
});

test("red: a check right in every baseline run is wrong", () => {
  const run = evalExport("run", 1, [
    ["E-91 orderNumbers", "E-92 orderNumbers"],
  ]);
  const verdict = judge([baseline], run);
  expect(verdict.outcome).toBe("red");
  if (verdict.outcome === "no verdict") return;
  expect(verdict.regressions).toEqual([
    {
      id: "E-91",
      check: "orderNumbers",
      baselineRight: 10,
      baselineRuns: 10,
      reason: 'got ["other"], expected []',
    },
  ]);
});

test("two baseline files count together", () => {
  // In a second baseline file, E-91 orderNumbers is wrong once:
  // 19 of 20 baseline runs right, so it is no longer guarded.
  const second = evalExport("second", 10, [["E-91 orderNumbers"]]);
  const run = evalExport("run", 1, [["E-91 orderNumbers"]]);
  const verdict = judge([baseline, second], run);
  expect(verdict.outcome).toBe("green");
  if (verdict.outcome === "no verdict") return;
  expect(verdict.known[0]).toMatchObject({
    baselineRight: 19,
    baselineRuns: 20,
  });
});

test("no verdict: an ERROR in the eval run", () => {
  const verdict = judge([baseline], evalExport("run", 1, [["E-92 ERROR"]]));
  expect(verdict).toEqual({
    outcome: "no verdict",
    reasons: ["run: E-92 is an ERROR (Overloaded)"],
  });
});

test("no verdict: more than one eval run", () => {
  const verdict = judge([baseline], evalExport("run", 10));
  expect(verdict.outcome).toBe("no verdict");
});

test("no verdict: different labels than the baseline", () => {
  const run = evalExport("run", 1, [], { "E-92": { intents: ["spam"] } });
  const verdict = judge([baseline], run);
  expect(verdict).toEqual({
    outcome: "no verdict",
    reasons: [
      "baseline: E-92 has a different email text or different labels than the eval run",
    ],
  });
});
