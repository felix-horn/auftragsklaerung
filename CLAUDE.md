# CLAUDE.md

## What this is
German B2B email triage ("Auftragsklärung"). Extraction → derived urgency →
(later) ERP tools, retrieval, evals, approval queue. Built module by module.

## Stack facts — verified, do not re-derive
- Structured output on Anthropic goes via `output_config.format.schema`. Not a
  synthetic tool, not `tools`/`tool_choice`. Verified by dumping the request body;
  see docs/request-body-reference.json.
- AI SDK 7 (`ai@7`, `@ai-sdk/anthropic@4`): `generateText` + `output: Output.object()`.
  No auto-retry on validation failure — failures throw `NoObjectGeneratedError`.
- Zod constraints beyond type and enum do not survive into the emitted JSON Schema.
  `.min()`/`.max()` are demoted to prose inside `description` (verified twice:
  `confidence` bounds, `intents` minItems). `.refine()` cannot be expressed at all.
  Only `type`, `enum`, `required` and `additionalProperties` are server-enforced.
  Everything else is a request to the model, caught by Zod on the return path. Check
  the dumped body before assuming otherwise.
- claude-sonnet-5 returns 400 for non-default `temperature`, `top_p` or `top_k`. Never
  send them.
- claude-sonnet-5 runs adaptive thinking by default at effort high. There is no
  thinking budget and no off switch. Run-to-run variance is therefore irreducible by
  configuration: measure it with repeated runs, do not try to eliminate it.
- Anthropic `output_tokens` already includes thinking tokens. Gemini's
  `thoughtsTokenCount` is additive on top of `candidatesTokenCount`. Do not sum them
  the same way.
- tsx and vitest strip types without checking them. `npx tsc --noEmit` is the only
  type check. tsconfig.json has no `include`, so it checks every .ts file in the
  repo, test files included.
- vitest 5.0.1 needs vite as a required peer; npm installs it automatically. A fresh
  `npm install` of vitest 5.0.1 crashes npm 10.9 ("Cannot read properties of null
  (reading 'edgesOut')"); npm 11 installs it, and `npm ci` from the lockfile works
  under npm 10 as well. In CI, install with `npm ci`.
- promptfoo 0.123.0 loads .ts files (provider, test generator, assertion) by
  registering tsx itself; imports with `.js` names resolve to the `.ts` files, as
  under tsx and vitest. No withheld install script is needed for this.
- promptfoo loads `.env` from the working directory on startup (dotenv, no
  override: a variable already set in the shell wins). npm scripts run in the repo
  root, so `npm run eval` gets the key from the repo's .env. Never use a config
  `env:` block: promptfoo copies the config into every results file. Checked in a
  scratch copy: the key appears in no results file, database entry or log.
- A `file://` provider in a YAML config must be a class: promptfoo calls `new` on
  the default export. Plain functions only work from a TypeScript config.
- promptfoo retries a provider error whose message mentions a rate limit (up to 3
  times, about a minute apart), on top of the AI SDK's own `maxRetries: 2`.
- `--retry-errors` crashes with this layout (it resolves the provider path against
  the working directory, not evals/). Use `--filter-errors-only <eval id>`.
- promptfoo is pinned; ignore its update notice. An upgrade is its own commit.

## Conventions
- Use `messages`, never the `prompt` shorthand. "The prompt" as a term means the
  system prompt, the user message and the schema descriptions together — all three
  are sent to the model and all three can move a result.
- The system prompt is `DEFAULT_SYSTEM` in src/extract.ts. Do not inline it again;
  source indentation inside a template literal is sent over the wire.
- Urgency is derived in code (`deriveUrgency` in src/urgency.ts), never asked of the
  model.
- Golden eval labels derive from docs/POLICY.md (Module 3), never from the system
  prompt. Rewording a prompt must not be able to move a label.
- After changing DEFAULT_SYSTEM, schema.ts, or any generateText parameter: run
  `DUMP_REQUEST_BODY=docs/request-body-reference.json npm run dump`, then
  `git diff docs/request-body-reference.json`. Commit the regenerated reference in
  the same commit as the change that moved it. An unexpected diff means stop.
- Business rules live in docs/POLICY.md. A change that would move a golden label
  is a policy change: amend POLICY.md first, with a version bump, then the
  implementation. Never the reverse.
- Code values live in two places that nothing links: the enums in
  src/schema.ts and the mapping tables in docs/LABELLING.md (section
  Zuordnung). After renaming an enum value, update LABELLING.md by hand.
  src/golden/cases.ts needs no reminder: it imports the enums and fails to
  load on a stale value.
- Tests: `<name>.test.ts` next to the file under test, explicit
  `import { expect, test } from "vitest"`, no vitest config file. Unit tests never
  call the API. Golden values are imported from src/golden/cases.ts, never copied
  into a test file; hand-written test values are invented. Check every change with
  `npm test` and `npx tsc --noEmit`.
- Pipeline code lives directly in src/ (urgency.ts, identifiers.ts). Code that
  compares model output with golden labels lives in src/golden/ (compare.ts,
  deadline.ts) and is never called by the pipeline. evals/assertions/fields.ts
  only applies those helpers per field for promptfoo.
- Everything promptfoo loads lives in evals/ (config, providers/, assertions/,
  golden-tests.ts); nothing in src/ imports promptfoo.
- Pipeline functions return data and print nothing. Entry points decide what to
  show: run.ts prints, the promptfoo provider reports to promptfoo.

## Observed numbers (20-email set, module-2 tag)
- Input: ~1890–2000 tokens per email
- Output: 75–484 tokens per email; reasoning tokens 0 on clean cases, 200–350 on
  hard ones
- All 20 schema-valid

## Observed numbers (22-case set, first promptfoo run, 29.09.2026)
- All 22 schema-valid. 18 s at promptfoo's default concurrency of 4.
- Input: 1892–2004 tokens per email, 42,924 in total
- Output: 75–594 tokens per email (mean 178), 3,920 in total. Highest: E-17 594,
  E-18 430, E-16 251. Lowest: E-05 and E-19, 75 each.
- Cost of one full run: about 12.5 US cents ($2 / $10 per million input / output
  tokens for claude-sonnet-5; output includes thinking).

## Observed numbers (22-case set, 3.6 baseline, 01.10.2026)
- Baseline run for Open experiments: eval-iSz-2026-10-01T16:56:58, 0 errors.
  Tokens 42,924 input / 3,961 output, about 12.5 US cents.
- Correct out of 22: schemaValid 22, intents 20, requestedAction 21, orderNumbers
  19, customerNumbers 21, escalationSignals 22, deadlineStated 22, urgency 22.
  Field comparisons 147/154 (95.5%; the 3.3 annotator agreement was 148/154 on the
  same seven fields, but it measured the policy's clarity, not the model). Cases
  with every field right: 16/22.
- The 29.09 answers (eval-qe7-2026-09-29T16:58:53), graded with the same checks in
  a scratch copy: 146/154, 15/22 cases. Same misses as the baseline in E-07, E-14,
  E-16, E-18, E-21; differences: see Golden set, seen in the first runs.

## Commands
- `npm test` — runs every *.test.ts file once (vitest); no API calls
- `npx tsc --noEmit` — type check; the only one
- `npm run extract` — runs the 22 golden-set emails (src/golden/cases.ts) through the extractor
- `npm run golden:check` — validates the golden set and reports how many cases are labelled
- `DUMP_REQUEST_BODY=<path> npm run dump` — one API call, writes the exact wire payload
- `npm run eval` — promptfoo runs the 22 golden cases through extractEmail (22 API
  calls, about 12.5 US cents). Pass options after `--`: `--filter-first-n 1`,
  `--filter-pattern 'E-1[45]'`, `--filter-errors-only <eval id>`. Exits with code
  100 (silently) when any case fails.
- `npx promptfoo view` — browser view of past runs: accuracy per field above the
  results, Display → Failures, details per case (Evaluation and Metadata tabs)
- `PROMPTFOO_DISABLE_TELEMETRY=1 npx promptfoo export eval <eval id> -o <file>` —
  a stored run as JSON; no API call

## Eval comparison (Module 3.4)
How a model output is compared with a golden label from 3.6 on. Each function is
tested in the .test.ts file next to it.
- Lists (`intents`, `orderNumbers`, `customerNumbers`, `escalationSignals`):
  `hasSameItems` in src/golden/compare.ts. Order is ignored; duplicates count
  (both sides are sorted, not turned into a Set), so a doubled value in the output
  fails. Identifiers are compared exactly, without tolerance.
- `intents`: reduced to their code values with `intentTypes` first. Confidence is
  dropped, not used as a filter; the 0.5 cut stays in schema prose (see Open
  experiments).
- `deadlineStated`: presence (null vs. text) is a separate check, because a missed
  or invented deadline moves urgency (R-13) and a wording difference does not.
  Wording: `deadlineQuoteMatches` in src/golden/deadline.ts. The normalised label
  must be contained in the normalised output (lower case, whitespace collapsed,
  punctuation at the very end removed, on both sides). Containment, not equality:
  the schema says "quoted verbatim" but not how much to quote, and LABELLING.md's
  quoting convention is for annotators only. Known limit, pinned by a test: extra
  words around the label are accepted. If the 3.6 raw outputs show over-long
  quotes, telling the model how much to quote is a prompt experiment. No calendar
  resolution: the emails carry no sent date, and R-12 anchors deadlines to the time
  of writing.
- `requestedAction`: present vs. null only (see Deferred design questions,
  assertion coverage).
- `urgency`: `deriveUrgency` takes
  `Pick<EmailExtraction, "escalationSignals" | "deadlineStated">`, so it accepts a
  golden label as well as a model output. Tested against every labelled case plus
  one hand-written R-13 case (repeated contact with a deadline stays medium) that
  no golden case covers. The golden-case tests passed on the first run by
  construction (R-13 was written from the function); their value is catching later
  drift between code and rule.
- R-09 prefix assignment: `assignByPrefix` in src/identifiers.ts. Pipeline code,
  not called by extractEmail yet (see Open experiments). Stufe 1 only: a number in
  the exact R-09 format goes to the list its prefix names; every other number stays
  in the list the model chose, because Stufe 2 and 3 depend on words only the model
  sees. Nothing is added, removed or merged. "Exact format" means capital `A-` or
  `K-` followed by five digits. This reading was chosen in 3.4; POLICY.md does not
  say whether e.g. "A-5521" carries the prefix. No golden case depends on it; if
  one appears, settle it in POLICY.md.

## Eval harness (Module 3.5)
- evals/providers/extract-email.ts calls extractEmail: the pipeline is under test,
  not the prompt in isolation. It reports token usage to promptfoo.
- Test cases come from src/golden/cases.ts through evals/golden-tests.ts (one per
  case: description = id, vars.email = email, metadata.labels = labels; see Eval
  assertions).
- The prompt template is `'{{email}}'`, a passthrough. With the echo provider, all
  22 emails were checked to arrive unchanged (Nunjucks autoescape is off).
- Separating question for a case without a valid extraction: does it say something
  about the pipeline, or only about the environment?
  - Schema failure (`NoObjectGeneratedError`, or `NoOutputGeneratedError` when
    there is no answer text) is a result of the pipeline: the provider passes the
    raw text on as output and evals/assertions/schema-valid.ts fails the case. It
    counts as a failed case with every field wrong and is never excluded from the
    accuracy denominator; otherwise a model that breaks on the hardest emails
    scores better, because those cases drop out.
  - Every other error (key, network, rate limit, server) is returned as a promptfoo
    ERROR: not measured, re-run with `--filter-errors-only <eval id>`.
- extract.ts must not catch these two errors and return a fallback object.
  Letting the error propagate, or logging and rethrowing, is fine. Returning a
  default (empty arrays, `other`) is not: it turns a failure into a
  plausible-looking wrong answer.
- extractEmail returns `{ output, usage }` and prints nothing (see Conventions).

## Eval assertions (Module 3.6)
- Labels travel as test metadata (`metadata.labels`, generated from cases.ts at
  load time). promptfoo stores them with every result, so a stored run shows what
  it was graded against. Assertions read `context.test.metadata`;
  `context.metadata` is the provider response's metadata. The provider class gets
  the test case too but reads only the prompt: no label reaches the model.
- evals/assertions/fields.ts: one named export per labelled field, loaded as
  `file://assertions/fields.ts:<field>`, each with `metric: <field>`. schema-valid.ts
  stays, with `metric: schemaValid`. A case passes only if all eight pass.
- Shared wrapper `fieldAssertion`: missing labels throw (ERROR: harness problem);
  an output that is not a valid extraction returns a failed result with reason
  `no valid extraction` in every field, never a throw (a throw removes the case
  from every metric's count). Pinned by evals/assertions/fields.test.ts (25 tests,
  no API).
- A misspelt export name in the config (`fields.ts:intent`) is not caught by tsc;
  every case becomes an ERROR.
- Per-field accuracy = namedScores ÷ namedScoresCount (export JSON) or read in the
  view. Report it only from a run with 0 ERRORs; after an ERROR repeat the whole
  run instead of combining two evals.
- 22 cases: one miss moves a field's accuracy (and the case pass rate) by about
  4.5 points. Quote every number with that.
- Rule coverage (POLICY v1.3 → check → cases that exercise it):
  | Rule | Checked by | Cases |
  |---|---|---|
  | R-01 | partly: invented values in requestedAction presence, number lists, escalationSignals | E-07, E-13, E-14 |
  | R-02 | numbers exact, deadline wording; German free text: none | E-16 |
  | R-03 | intents | E-05, E-19 |
  | R-04 | intents | E-09, E-16, E-18 |
  | R-05 | intents | E-04, E-12, E-15, E-22 |
  | R-06 | requestedAction presence; wording: none | E-11, E-14 |
  | R-07 | requestedAction presence | E-05, E-19 |
  | R-08 | orderNumbers | E-02, E-06, E-11 |
  | R-09 | orderNumbers, customerNumbers | E-04, E-07, E-08, E-16, E-21 |
  | R-10 | escalationSignals | E-04, E-12, E-13, E-14, E-18 |
  | R-11 | escalationSignals | E-04, E-08, E-16 |
  | R-12 | deadlineStated | E-04, E-08, E-10, E-12, E-20 |
  | R-13 | urgency | all |
  | Begriffe (instructions inside the message) | intents | E-17 |
  Not covered: R-02's German free text and the content of requestedAction (only
  presence is compared), so an invented detail inside a stated action passes.

## Open experiments
Run once the eval harness exists (after 3.6). Each changes one thing; compare
against the baseline.
- Sender premise: remove the claim in DEFAULT_SYSTEM that all senders are
  customers. Target: E-19.
- Field rename: `requestedAction` → `requestStated`. Target: E-14.
- Null example: the `requestedAction` description gives "pure venting" as its
  null example; E-14 is a calm factual complaint. Replace the example. Target:
  E-14. Run separately from the rename.
- Injection line: run with and without the embedded-instruction rule in
  DEFAULT_SYSTEM. Target: E-17.
- Confidence threshold: move the 0.5 cut from schema prose into code. Needs
  3.7 calibration data first.
- Prompt language: German DEFAULT_SYSTEM against the English one. Whole set.
- Prefix assignment: run `assignByPrefix` on the model's numbers inside
  extractEmail. Target: E-21. It can only fix Stufe 1 errors.
- Reason vs. request (R-04): say in the `intents` description that a fact which
  only explains another request is not an intent of its own. Targets: E-16
  (adds complaint), E-18 (adds order_status).
- Unnamed numbers (R-09 Stufe 3): say in the number descriptions that a number the
  customer does not call an order or customer number is recorded in neither list.
  Target: E-07.
- Deadline extent: say in the `deadlineStated` description to quote the time
  together with the word that introduces it ("bis", "spätestens"). Target: E-08,
  E-12 (short quotes on 29.09 only).

## Deferred design questions
- `other` used as a hedge (E-16, E-17): sharpen prose, remove the enum value,
  or require a justification field. After 3.6.
- Split "does this belong in the queue" from "what does the customer want"
  into two fields. After 3.6.
- Scheduled eval run (3.8): add a `schedule:` trigger to the eval GitHub Actions
  workflow next to the push/PR trigger, running the golden-set eval daily (e.g.
  cron `17 3 * * *`, UTC) against the production configuration: same model IDs,
  same settings. The push gate only answers "did my change break the known
  cases?". It cannot catch provider-side changes without a code change: an alias
  repointed to a new model, or infrastructure bugs behind a pinned model ID
  (precedent: Anthropic's Aug–Sep 2025 incident degraded API output without a
  model version change). Cost: a few lines of YAML, plus 22 calls per run at about
  12.5 US cents (Observed numbers). Without it, a provider-side regression goes
  unnoticed until the people reviewing drafts complain. Related check: all model
  IDs are pinned; no Gemini `-latest` or `-preview` IDs, and no pre-4.6 dateless
  Claude aliases such as `claude-sonnet-4-5`. From the 4.6 generation onward the
  dateless ID is the fixed snapshot. Open for 3.8: how a failed scheduled run
  reaches Felix (notification channel).
- Golden set size: 22 cases in Module 3. Expand when statistical resolution
  is needed (Module 5 onward), not before.
- Unprefixed identifiers recorded as written (R-09 step 2) get normalised at
  the ERP lookup. Module 4.
- Reply drafting is Module 5b (added to the roadmap in 3.1). The LLM-as-judge
  eval for drafts and the reply-language decision go with it.
- Does `requestedAction` earn its place in the approval queue UI? Module 7.
- POLICY.md's examples are taken from the golden-set emails. So POLICY.md, or
  any excerpt of it, must never be put into the prompt: the eval would then
  measure how well the model repeats examples it was shown, not how it handles
  new emails. If the policy is ever to be used as prompt material, the golden
  set needs fresh emails first.

## Golden set (Module 3.3)
- 22 cases in src/golden/cases.ts, labelled from docs/POLICY.md alone.
- Second annotator: Gemini in AI Studio (model gemini-pro-latest, which
  pointed to gemini-3.1-pro-preview at the time; thinking level high), fresh
  session, given only POLICY.md (v1.2), LABELLING.md and the email texts.
  Agreement with the human annotator before reconciliation: 96.1% (148/154
  field comparisons); intents 19/22, requestedAction 21/22 (compared present
  vs null), orderNumbers 21/22, customerNumbers 21/22, escalationSignals,
  deadlineStated and urgency 22/22. After reconciliation it is 100% by
  construction and says nothing.
- Every difference was resolved against POLICY.md. One of them (E-16) led
  to a policy clarification (v1.3). v1.2, the Kaufanfrage rename, came
  earlier, from reviewing LABELLING.md.
- The second annotator marked E-12 as uncertain: the demanded Gutschrift
  reads like Reklamation, but Reklamation excludes complaints about an
  invoice. Both annotators labelled `invoice_question`. Likely blur case in
  3.6.
- Expected baseline failures, written down before the first run on this
  set so that 3.6 can tell expected from surprising ones.
  Seen in earlier runs: E-14 invents a requestedAction (label: null);
  E-16 and E-17 add `other` as a hedge.
  Possible under the policy, not yet seen: E-16 adds `complaint` or
  `document_request` and E-18 adds `order_status` (labels: one intent each;
  R-04, POLICY v1.3); E-07 puts the bare 78432 into an array (label: both
  empty, R-09 step 3); E-21 puts K-62418 into orderNumbers because the
  customer calls it "Bestellnummer" (label: customerNumbers, R-09 step 1).
- Seen in the first runs (29.09 and the 01.10 baseline), recorded after the
  predictions above and without changing them:
  - In both runs: E-14 invents a requestedAction; E-16 adds `complaint`; E-18
    adds `order_status`; E-07 puts 78432 into orderNumbers; E-21 puts K-62418
    into orderNumbers instead of customerNumbers.
  - Not seen in either run: `other` as a hedge (E-16, E-17); a wrong intent in
    E-12.
  - 01.10 only: E-12 returns no order number (label A-48120).
  - 29.09 only: E-08 quotes "Freitag", E-12 "30.04." (labels "bis Freitag", "bis
    zum 30.04." per LABELLING.md); the containment rule counts both as wrong.
  - The texts of E-07, E-14, E-16 and E-18 appear as examples in POLICY.md,
    E-21's wording nearly so. The model never sees POLICY.md; it fails where a
    policy rule is not stated in the prompt.
  - Blur: of the six fields disputed in 3.3, only E-16 `intents` is missed, and
    POLICY v1.3 (R-04's example) now decides it word for word. No miss is a blur
    case.
