import type { TestCase } from "promptfoo";
import { goldenCases } from "../src/golden/cases.js";

// promptfoo calls this function once, while loading the config,
// and runs one test case per golden case.
// `vars.email` fills the '{{email}}' prompt,
// which the provider sends to the model.
// `metadata.labels` carries the correct answers to the field assertions
// in assertions/fields.ts.
// promptfoo hands the whole test case to the provider as well,
// but ExtractEmailProvider reads only the prompt,
// so no label ever reaches the model.
export default function goldenTests(): TestCase[] {
  return goldenCases.map(
    (goldenCase): TestCase => ({
      description: goldenCase.id,
      vars: { email: goldenCase.email },
      metadata: { labels: goldenCase.labels },
    }),
  );
}
