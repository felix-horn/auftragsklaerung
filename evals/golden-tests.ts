import type { TestCase } from "promptfoo";
import { goldenCases } from "../src/golden/cases.js";

// promptfoo calls this function once, while loading the config,
// and runs one test case per golden case.
// The labels are not passed on yet:
// 3.6 adds them together with the assertions that use them.
export default function goldenTests(): TestCase[] {
  return goldenCases.map(
    (goldenCase): TestCase => ({
      description: goldenCase.id,
      vars: { email: goldenCase.email },
    }),
  );
}
