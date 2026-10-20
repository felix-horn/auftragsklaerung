# CLAUDE.md

## What this is

German B2B email triage ("Auftragsklärung"). Extraction → derived urgency →
ERP stage (Module 4) → (later) retrieval, reply drafts, approval queue; evals
throughout. Built module by module.

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
  Measured in 3.7: see Noise and comparing runs.
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
- promptfoo's response cache only applies to its built-in model providers. The
  custom provider calls extractEmail directly, so its answers are never cached:
  checked in 3.7, evals without `--no-cache` still sent every request. The flag
  stays in the script; it is harmless.
- `--repeat <n>` runs every test case n times inside one eval: one eval ID, 22·n
  results, and the metric boxes count all of them. testIdx runs case by case
  (E-01's n repeats first), so the k-th result of a case is its repeat k. The CLI
  table shows 25 rows. The web view has no per-case summary across repeats; its
  search box searches outputs, not descriptions.
- `--filter-errors-only <id>` re-runs the test case, not the missing repeat: in a
  new eval, as often as `--repeat` says (once without it). It cannot fill a gap in
  a repeated eval; after an ERROR, re-run the whole eval.
- `promptfoo eval -o <file>.json` writes the same shape as `promptfoo export eval`;
  evals/report.ts and evals/gate-cli.ts read both. Checked in 3.8.
- promptfoo 0.123.0 reads `PROMPTFOO_FAILED_TEST_EXIT_CODE` (default 100): the exit
  code when the pass rate is below `PROMPTFOO_PASS_RATE_THRESHOLD`. CI sets it to 0,
  so wrong emails and ERRORs no longer fail the eval step; a broken config still
  does. On GitHub (`GITHUB_ACTIONS` set) promptfoo prints `::notice::` progress
  lines, which GitHub shows as annotations.
- GitHub Actions (06.10.2026): runner image ubuntu-24.04, `setup-node` with
  `node-version: 24` gives Node 24.21.0 and npm 11.19.0 (the same npm as locally,
  so the same `allowScripts` warnings). `npm ci` takes 40–47 s of a 57–74 s run.
- A secret that does not exist becomes an empty string: `ANTHROPIC_API_KEY` is
  empty and Anthropic answers 401 `x-api-key header is required` for all 22 emails
  (22 ERRORs, gate: no verdict). Re-running that run after storing the secret
  picked up the new secret (06.10.2026).
- `npm ci` in CI reports 15 `npm audit` vulnerabilities (06.10.2026), all deep in
  dev dependencies (mostly promptfoo's tree: simple-git, basic-ftp,
  source-map-js). Not a failure (exit code 0). Never `npm audit fix --force`: it
  may change major versions, promptfoo included. See Deferred design questions.
- `@ai-sdk/anthropic` 4.0.49 accepts `apiKey` or `authToken` (Bearer), but does
  not do Anthropic's workload identity federation exchange (only Anthropic's own
  SDKs read `ANTHROPIC_IDENTITY_TOKEN_FILE`). See Deferred design questions.

### Tool calling (Module 4.1; `ai` 7.0.93, `@ai-sdk/anthropic` 4.0.49)

Each fact says how it was checked: in the source (node_modules/ai/src), with a
fake fetch (no API), or in a real run of a 04_module/ script.

- `result.output` is parsed from the last step only, and only if that step's
  finishReason is `stop`, or is not `tool-calls` and has text
  (generate-text.ts lines 1563–1579). Otherwise reading it throws
  `NoOutputGeneratedError`. An answer with JSON text and a tool call ends in
  `tool-calls`: `text` holds the JSON, `output` throws. Source; real runs for a
  tool call only (throws) and for an extraction after a lookup (parsed from
  request 2); fake fetch for the mixed answer.
- `result.text` is the last step's text and never throws (an empty string if
  the loop stopped on a tool call). `result.toolCalls` and `result.toolResults`
  collect every step. Source.
- Without `stopWhen` the SDK sends one request. A tool with `execute` still
  runs; its result lands in `result.toolResults` and the model never sees it.
  With `stopWhen: isStepCount(n)` the SDK sends the result back and asks again,
  up to n requests. Fake fetch; the loop also in real runs.
- `toolChoice` on the wire: `auto` → `{"type":"auto"}`, `required` →
  `{"type":"any"}`, `{ type: "tool", toolName }` →
  `{"type":"tool","name":…}`, `none` → the provider removes `tools` and
  `tool_choice` from the body (15 input tokens; the model no longer knows the
  tools exist). Real runs.
- Forced tool use (`required` or a named tool) is accepted by claude-sonnet-5.
  Per Anthropic's thinking docs the answer then starts with the tool call,
  without thinking, and Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1
  refuse forced tool use with a 400. Check this before changing the model ID.
  Real run for sonnet-5 (no thinking block, but `auto` had none either on that
  question); docs only for the rest.
- Tool inputs are not schema-enforced: a forced checkStockLevel came back with
  `{ orderNumber: 44821 }` (wrong field, a number). The SDK does not throw; it
  keeps the call with `invalid: true` in `dynamicToolCalls` (not
  `staticToolCalls`) and adds a `tool-error` part, so a hand loop over
  `staticToolCalls` never sees it. `strict: true` on the tool is the candidate
  fix; not tried (4.4). Real run; source and fake fetch for where it is kept.
- An error thrown in `execute` goes to the model as a `tool_result` with
  `is_error: true` and the content `Error: <message>`. Fake fetch.
- `toolsContext` values reach `execute` as `context` and never appear in the
  request body, so they can carry what the model must neither see nor set, such
  as the requester's identity (4.4). Fake fetch.
- Thinking blocks from a tool turn go back in the next request unchanged,
  signature included; the SDK does this. Real run.
- AI SDK 7 renames: `instructions` replaces `system` (deprecated, still
  works); `isStepCount` replaces `stepCountIs` (kept as an alias). Source.
  src/extract.ts still passes `system`; renaming it is its own commit, with the
  request-body dump (Conventions).

## Conventions

- Use `messages`, never the `prompt` shorthand. "The prompt" as a term means the
  system prompt, the user message and the schema descriptions together — all three
  are sent to the model and all three can move a result.
- The system prompt is `DEFAULT_SYSTEM` in src/extract.ts. Do not inline it again;
  source indentation inside a template literal is sent over the wire.
- Urgency is derived in code (`deriveUrgency` in src/urgency.ts), never asked of the
  model.
- The extraction records facts from the email. A decision that follows from
  recorded facts by a fixed rule is made in code, never asked of the model:
  urgency, and which ERP lookups run (see ERP stage). If a decision needs
  something the extraction doesn't record, add a fact field, not a field that
  names the action.
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
- mock-erp/ stands in for an outside system (Module 4.3): neither pipeline nor
  eval code. It imports the contract from src/erp-contract.ts; nothing in src/
  imports mock-erp/.
- Everything promptfoo loads lives in evals/ (config, providers/, assertions/,
  golden-tests.ts); nothing in src/ imports promptfoo. evals/report.ts,
  evals/gate.ts, evals/gate-cli.ts and evals/baseline/ live there too but are not
  loaded by promptfoo: they read exported evals.
- Pipeline functions return data and print nothing. Entry points decide what to
  show: run.ts prints, the promptfoo provider reports to promptfoo.
- 04_module/ holds Module 4's teaching scripts and experiments. The 4.1 scripts
  call the API directly, with no fake switch (Felix's decision, 4.1: easier to
  read is worth the occasional cent), and print every request and response body
  through 04_module/logging-fetch.ts. minimal-http-server.ts (4.3) is node:http
  on its own: no API, no ERP. Nothing in src/ imports them; tsc checks them.

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

- Single-run baseline until 3.7: eval-iSz-2026-10-01T16:56:58, 0 errors.
  Tokens 42,924 input / 3,961 output, about 12.5 US cents.
- Correct out of 22: schemaValid 22, intents 20, requestedAction 21, orderNumbers
  19, customerNumbers 21, escalationSignals 22, deadlineStated 22, urgency 22.
  Field comparisons 147/154 (95.5%; the 3.3 annotator agreement was 148/154 on the
  same seven fields, but it measured the policy's clarity, not the model). Cases
  with every field right: 16/22.
- The 29.09 answers (eval-qe7-2026-09-29T16:58:53), graded with the same checks in
  a scratch copy: 146/154, 15/22 cases. Same misses as the baseline in E-07, E-14,
  E-16, E-18, E-21; differences: see Golden set, seen in the first runs.

## Observed numbers (22-case set, 3.7, ten runs, 02.10.2026)

- Baseline for Open experiments: eval-6y4-2026-10-02T13:59:42 (`--repeat 10`,
  export in the repo since 3.8: evals/baseline/eval-3.7-repeat10.json), 220
  results, 0 errors. Tokens 429,240 input /
  40,425 output, about 1.26 US dollars.
- Correct out of 220: schemaValid 220, intents 195, requestedAction 210,
  orderNumbers 198, customerNumbers 210, escalationSignals 220, deadlineStated 212,
  urgency 220. Answers with every check right: 159/220.
- Per run (run k = the k-th result of each case): field comparisons 148, 146, 145,
  146, 145, 146, 148, 146, 147, 148 (145–148 of 154); emails fully right 17, 15,
  15, 15, 16, 16, 17, 15, 16, 17 (15–17 of 22). The 01.10 (147, 16) and 29.09
  (146, 15) runs lie inside this range.
- Of 176 checks per run, 165 were right in all ten runs, 6 wrong in all ten and 5
  changed (Golden set, seen in the 3.7 ten runs). Only the 5 move a run's total;
  the 6 cap it at 148.

## Observed numbers (22-case set, CI, from 06.10.2026)

- First CI eval runs on main (one run each, gate green): 06.10 eval-nmJ 16/22
  emails, 147/154 fields (the 6 always-wrong checks plus E-12 deadlineStated
  "30.04."); 07.10 eval-OL4 17/22, 148/154 (the 6 only). Both inside the 3.7 range.
- Scheduled runs (the false-alarm count, see Gate false alarms under Deferred
  design questions): 08.10 eval-ot3, gate green, 17/22 emails, 148/154 fields
  (the 6 always-wrong checks only), inside the 3.7 range. Due at 03:17 UTC,
  started at 10:43 UTC: 7 h 26 min late (GitHub documents delays under load).
  08.–16.10 (runs #8 to #22, read off the Actions list on 17.10): one scheduled
  run every day, none dropped, all nine green; started 5 h 00 min to 7 h 44 min
  late (08:17–11:01 UTC). False alarms so far: 0 in 9 scheduled runs.
- Tokens per run 42,924 input / 3,937–4,189 output, about 12.5–12.8 US cents. Eval
  step 15–17 s at concurrency 4; whole CI run 57–83 s.
- Step 5 demo (branch demo/break-prompt, deleted afterwards): removing "Do not
  include requested or promised delivery dates." from the deadlineStated
  description made E-10 answer deadlineStated "15.04." (label null), and urgency
  followed (medium, label low). Both checks were 10/10 in the baseline: gate red.

## Commands

- `npm test` — runs every \*.test.ts file once (vitest); no API calls
- `npx tsc --noEmit` — type check; the only one
- `npm run extract` — runs the 22 golden-set emails (src/golden/cases.ts) through the extractor
- `npm run golden:check` — validates the golden set and reports how many cases are labelled
- `DUMP_REQUEST_BODY=<path> npm run dump` — one API call, writes the exact wire payload
- `npm run eval` — promptfoo runs the 22 golden cases through extractEmail (22 API
  calls, about 12.5 US cents). Pass options after `--`: `--filter-first-n 1`,
  `--filter-pattern 'E-1[45]'`, `--filter-errors-only <eval id>`. Exits with code
  100 (silently) when any case fails.
- `npm run eval -- --repeat 10` — every case ten times in one eval (220 API calls,
  about 1.25 US dollars, about 3 minutes). The baseline and every experiment run
  this way (see Noise and comparing runs).
- `npm run eval:report -- <export.json>` — evals/report.ts over an exported eval:
  checks not right in every run, totals per run and over all runs, intent
  confidences next to the labels. No API call; refuses an eval with ERRORs.
- `npm run eval:gate -- <export.json>` — the CI gate (see CI) on one eval run
  against every export in evals/baseline/. No API call. Exit code 0 green, 1 red,
  2 no verdict.
- Every model answer of an export, indented (no API call):
  `node -e 'const d=require(process.argv[1]); for (const r of d.results.results.sort((a,b)=>a.testIdx-b.testIdx)) console.log(r.testCase.description, JSON.stringify(r.response?.output, null, 2))' <export.json>`
- `npx promptfoo view` — browser view of past runs: accuracy per field above the
  results, Display → Failures, details per case (Evaluation and Metadata tabs)
- `PROMPTFOO_DISABLE_TELEMETRY=1 npx promptfoo export eval <eval id> -o <file>` —
  a stored run as JSON; no API call
- `npx tsx 04_module/<file>.ts` — a Module 4.1 script (part1 to part4,
  experiment-*; see Ways to use a tool); 1–3 API calls, under 2 US cents.
  part4-tool-choice.ts takes `auto`, `required`, `none` or `checkStockLevel`.
- `npx tsx 04_module/minimal-http-server.ts` — Module 4.3's node:http example: a
  server on 127.0.0.1:4000 until Ctrl+C; no API call. Try
  `curl -i http://127.0.0.1:4000/hello` from a second terminal.
- `npm run erp` — the mock ERP on 127.0.0.1:4100 until Ctrl+C (see Mock ERP
  (Module 4.3)); no API call. Try
  `curl -s -w "\n%{http_code}\n" http://127.0.0.1:4100/orders/A-44821`.

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
  run instead of combining two evals. The same holds for a repeated eval.
- 22 cases: one miss moves a field's accuracy (and the case pass rate) by about
  4.5 points. Quote every number with that.
- Rule coverage (POLICY v1.5 → check → cases that exercise it; R-14 to R-17
  govern the ERP stage and no golden-set check covers them, see ERP stage):
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

## Noise and comparing runs (Module 3.7)

- The unchanged pipeline moves by chance: in the ten baseline runs a run's total
  ranged over 145–148 field comparisons and 15–17 fully right emails. Never
  compare single runs; one experiment run inside that range shows nothing.
- An experiment is one eval with `--repeat 10` and 0 ERRORs, compared with the
  baseline per check (one field of one email), from `npm run eval:report` on both
  exports. Ten runs against ten keeps one table for every comparison.
- A change counts when chance alone would produce it less than 1 time in 20
  (Fisher's exact test, one-sided, α = 0.05, 10 runs against 10):
  | Baseline right | Better from | Worse at |
  |---|---|---|
  | 0/10 | 4/10 | – |
  | 1/10 | 6/10 | – |
  | 2/10 | 7/10 | – |
  | 3/10 | 8/10 | – |
  | 4/10 | 9/10 | 0/10 |
  | 5/10 | 10/10 | 0/10 |
  | 6/10 | 10/10 | 1/10 |
  | 7/10 | cannot be shown | 2/10 |
  | 8/10 | cannot be shown | 3/10 |
  | 9/10 | cannot be shown | 4/10 |
  | 10/10 | – | 6/10 |
  "–": no result counts.
- Target checks get a verdict from the table: better, or not shown. Every check
  that was 10/10 in the baseline and is not in the experiment gets its answers
  read; at 6/10 or below it counts as harmed.
- Metric boxes and per-run totals describe; they never decide. A box mixes the
  target with 21 other emails: one email fixed in all ten runs moves it by 10 of
  220, chance moves the intents and deadlineStated boxes by about 3 of 220
  between two ten-run evals.
- Checks at 7/10–9/10 cannot show an improvement with ten runs; about 25 runs per
  side would be needed. Their experiments can only show harm.
- Limits: ten runs measure steadiness on these 22 emails, not accuracy on new
  ones. "Right in every run" is not "never wrong": a check that fails 1 time in
  20 comes out 10/10 in about 60% of ten-run evals. With many changing checks,
  about 1 in 20 verdicts can be chance.
- evals/report.ts grades nothing: it counts the pass/fail and the reasons the
  assertions stored. It groups results by description in testIdx order (run k =
  k-th result per case), sorts list answers because the checks ignore order,
  shows requestedAction only as present or null, and refuses evals with ERRORs.
  Its "All runs together" totals equal the metric boxes; checked against the view
  and against the 01.10 numbers (147/154, 16/22). No vitest test: these two checks
  cover the counting, and nothing in the pipeline reads its output.
- Confidence, ten baseline runs: 266 intent reports, 28 not in the label, all
  from E-12, E-16, E-17 and E-18, none above 0.80; all 220 reports at 0.85 or
  higher were in the label. Right intents also sit low: E-17's only intent
  `complaint` 0.60–0.70, E-18's `invoice_question` 0.55–0.75; in 6 of 10 E-18
  runs the wrong `order_status` had the higher confidence. By group: 0.9–1.0
  193/193 in the label, 0.8–0.89 27/31, 0.7–0.79 7/22, 0.6–0.69 10/16,
  0.5–0.59 1/4, below 0.5 none. Only 2–4 emails stand behind each group below
  0.8. The lowest confidence reported was 0.50 (once).

## CI (Module 3.8)

- .github/workflows/ci.yml, one job `checks` on ubuntu-latest, Node 24,
  `timeout-minutes: 10`. Triggers: push to any branch (`branches: ["**"]`, so tag
  pushes start no run), every night at 03:17 UTC on the newest commit of main
  (`schedule`, off the full hour because GitHub delays and may drop scheduled runs
  then), and the "Run workflow" button (`workflow_dispatch`).
- Steps, cheapest first (a failing step skips the rest): `npm ci`,
  `npx tsc --noEmit`, `npm test`, one eval run (`npm run eval -- -o
eval-result.json`, 22 API calls, about 12.5 US cents), upload of
  eval-result.json as an artifact (unzipped, kept 90 days, uploaded before the gate
  so a red run keeps it), `npm run eval:gate -- eval-result.json`.
- The key: repository secret `ANTHROPIC_API_KEY` (a separate Console key,
  github-actions-auftragsklaerung), set as `env:` on the eval step only, so the
  install scripts of `npm ci` never see it. GitHub masks it as `***`. This `env:`
  belongs to the workflow step; the promptfoo config still never gets an `env:`
  block.
- One eval run per push, never ten: CI asks "did a check break that never broke
  before?", one run answers that. Is the pipeline better or worse is still the
  ten-run comparison (Noise and comparing runs), by hand.
- The gate (evals/gate.ts, logic; evals/gate-cli.ts, command): every wrong check
  of the eval run is looked up in evals/baseline/. Right in every baseline run →
  the run is red (exit 1); wrong in some or all baseline runs (the flaky and the
  known failures) → listed, never deciding. Per check, not a count: a count per
  email or per field lets a wobbling email that happens to be right hide a real
  break, and misses one email fixed while another breaks in the same field.
  ERRORs, more than one result per email, or emails/labels that differ from the
  baseline → no verdict (exit 2), never green. evals/gate.test.ts pins the rules
  (7 tests, invented emails E-91/E-92); a mutation (rule line → `if (false)`) made
  the red test fail.
- A red run is a reason to look, not proof (one failure in 11 results lands in the
  new run by chance 1 time in 11). After a push: the change is the first suspect,
  the gate prints `got …, expected …`. After a nightly run with no new commit: run
  `npm run eval -- --repeat 10` (about 1.25 USD) and judge the check with the 3.7
  table (10/10 baseline: harmed at 6/10 or lower).
- evals/baseline/ holds the exports of the current pipeline; the gate adds them
  up, whatever the number of runs per file. After a red run on an unchanged
  pipeline whose ten-run check shows no harm, add two files in one commit: the
  ten-run export and the red run's own eval-result.json (artifact on the run
  page; rename it, since every run's artifact has that name). The red run is
  the only evidence that the check can fail: a check failing about 1 time in 30
  comes back 10/10 in ten new runs about 70% of the time ((29/30)^10 ≈ 0.71),
  so with the ten-run file alone it would stay guarded (20/20) and the false
  alarm could repeat; with both it is 20/21. Checked with a constructed run
  (E-01 orderNumbers broken; 3.8, repeated 08.10.2026): red against the 3.7
  ten runs alone ("right in 10/10"), green with that run's own export added
  as a second file ("right in 10/11"). Green nightly runs are not added: they
  contain no wrong guarded check, so they change no verdict; they count toward
  the false-alarm tally (Observed numbers (CI)) and stay on GitHub as artifacts
  for 90 days. When an experiment is adopted, its ten-run export replaces the
  folder's content in the same commit. After a label or email change, run the
  baseline again first.
- Notifications (Felix's decision, 3.8): GitHub email for failed runs only, set in
  GitHub → Settings → Notifications → System → Actions ("Email", "Only notify for
  failed workflows"). Scheduled runs notify whoever last changed the cron line.
- Nothing is blocked: commits go straight to main, a red run marks the commit and
  emails. Required status checks on pull requests would block, but add a branch
  and a pull request per step for one person; not set up.
- Repository is private: 2,000 free GitHub minutes a month, a run takes about 1–2.
  If it is ever made public, GitHub disables scheduled runs after 60 days without
  repository activity.
- Changing a prompt on a branch shows the gate at work without touching main
  (step 5 demo, see Observed numbers (CI)). A schema change on such a throwaway
  branch skips the request-body dump; changes that stay never do.

## Ways to use a tool (Module 4.1)

One file per way in 04_module/. Parts 1–4 ask "Where is my order 44821?" with
two tools, getOrderStatus and checkStockLevel (invented data). Every number
below is from one run: what can happen, not how often.

| Way | Who picks the call | Who runs it | Result back to the model | File |
|---|---|---|---|---|
| Code only | code, from fields it already has | code | no | none (today's pipeline) |
| Routing: the model names the call, code acts | model: a `tool_use` block, or a field in the structured answer | code | no | part1, round 1 only (see its comment); experiment-extraction-plus-tool.ts |
| Native tool calling, loop by hand | model | our loop | yes, in a new request with the whole history | part1-loop-by-hand.ts |
| Native tool calling, loop by the SDK | model | the SDK (`execute`, `stopWhen`) | yes | part2-loop-by-sdk.ts |
| Prompt-based tool calling (ReAct-style) | model: an `action` field in structured output, no `tools` | our loop | yes, as a user message | part3-action-field.ts |

- Parts 1 and 2 send the same two requests and give the same answer. The
  difference between the two files is what the SDK's loop takes over: the
  switch over tool names, appending the results, the stop condition. Part 3
  gets the same answer in two requests with no `tools` in either.
- part4-tool-choice.ts, one request per setting: `auto` 655 input tokens,
  getOrderStatus; `required` 775, getOrderStatus; `none` 15, no tool, and the
  model answered as a general chatbot ("retailers"); forced `checkStockLevel`
  784, input `{ orderNumber: 44821 }`. Two short tools cost about 640 input
  tokens per request; one tool on top of the extraction about 460–570.
- The extraction with a getOrderStatus tool, E-06, DEFAULT_SYSTEM and
  src/schema.ts unchanged:
  - no field for the choice (first version of experiment-extraction-plus-tool.ts,
    not committed): the answer was a tool call only, no extraction
    (`NoOutputGeneratedError`).
  - a `nextAction` field added in the experiment file only, its description
    saying the tools are listed only to be named there
    (experiment-extraction-plus-tool.ts): one request, a complete extraction
    plus `nextAction` getOrderStatus "A-44821", no tool call. 2,696 input tokens
    (the extraction alone 1,892–2,004), 172 output (41 thinking).
  - `execute` plus `stopWhen: isStepCount(3)`
    (experiment-extraction-after-lookup.ts; the tool's record names customer
    K-40928): request 1 called getOrderStatus, request 2 returned the
    extraction, and `output` was parsed from it. customerNumbers stayed `[]`
    (label `[]`): the ERP's number did not leak in this run. 2,461 + 2,604
    input, 91 + 98 output tokens, about 1.2 US cents.
- Where the ERP lookup sits was decided in 4.2: see ERP stage.

## ERP stage (Module 4.2)

Business rules: docs/POLICY.md R-14 to R-17 (since v1.4). Decided in 4.2;
built from 4.3 on.

- Pipeline: email text and sender address in. The text goes to the extraction
  (one model request, unchanged); the sender address goes to the ERP stage.
  Then urgency: R-13 from the extraction, raised by R-17 from order data.
  Later: reply drafts (6b), approval queue (8).
- The ERP stage is code only. Rules in code pick its lookups from what the
  extraction records and from the sender address. No model calls a tool, and
  no ERP answer reaches the extraction, so R-01 holds by construction. In
  Anthropic's terms a workflow (predefined code paths), shaped as prompt
  chaining with a code step between model requests.
- Two ERP functions in Module 4 (mock ERP, 4.3):
  - findCustomerBySender: every email (R-14). The match ignores case; a
    customer number in the text identifies nobody.
  - getOrderStatus: every recorded order number when the sender is assigned
    to a customer, whatever the intent (R-15). A number recorded without
    prefix is looked up with "A-"; only "A-" plus five digits is looked up.
    Returns status, promised delivery date, shipping date and the owning
    customer; the result is one of the R-16 outcomes. Customer numbers are
    never looked up, so no "K-" is added anywhere.
  - The permission check and the R-16 texts are enforced in code. A refused
    lookup records only its outcome text, nothing about the order.
- Mock ERP (built in 4.3): a plain `node:http` server in this repo, started as
  its own process, serving one JSON file of invented customers (with contact
  addresses) and orders. The seed holds what the end-to-end cases need (see
  Mock ERP (Module 4.3)). Zod schemas in src/ are the contract: the mock validates its data with them
  on load, our client validates every response with them. Base URL from
  `ERP_BASE_URL` in .env. Errors: 404 for an unknown order or address, and
  "not reachable"; both map to R-16 outcomes. "Today" for R-17 is passed in,
  never read inside the stage. Not Next.js: Next.js practice comes in Module
  8, where it is the app.
- Taken from Felix's mock backend of an earlier work project (DKLB), scaled
  down: base URL from env, a seed with problem cases, one contract shared by
  mock and client, deterministic time. Not taken, because nothing in Module 4
  writes data or lets a model call tools: OpenAPI with generated client and
  server types, monorepo, handler registry, stateful database, per-case
  database IDs, management endpoint, tool definitions derived from the spec
  (the last one fits Module 13's MCP server).
- A lookup is built in the module that builds the step consuming its result.
  getCustomerHistory, invoice and document lookups wait for 6b (Deferred design
  questions); checkStockLevel has no consumer (POLICY.md Kontext: the Vertrieb
  makes offers).
- When the model should choose the action instead (a `nextAction` field or
  tool calling): only when no recorded field decides the choice and calling
  every candidate is not acceptable (functions that change data, or a large
  tool set). Not the case in Module 4.
- Rejected in 4.2 (evidence: one run each in 4.1, Ways to use a tool):
  - Routing inside the extraction (`nextAction`, Felix's 4.1 design). It
    restates what `orderNumbers` decides and can contradict it; a field with
    one order forces a guess on E-02 (R-08: record both); its golden labels
    would need a POLICY.md rule that code can apply directly.
  - Extraction after a lookup in one SDK loop. The extraction is written with
    ERP data in context (R-01; no leak in the one run, rate unmeasured), and an
    ERP error reaches the model mid-loop.
  - A separate step with its own tool loop. A second model answers what the
    extraction already answered.
  - Not used as reasons (Felix, 4.1): API cost, eval baseline stability.
- Sources read for the decision: Anthropic, "Building effective agents"
  (19.12.2024): workflows for well-defined tasks, agents where the steps can't
  be fixed in advance. AI SDK docs, node_modules/ai/docs/03-agents/
  01-overview.mdx and 03-workflows.mdx (routing example: the model classifies,
  code picks the next step from a table).
- Test data. The sender address is email metadata, never extracted, and not
  part of a golden case. End-to-end cases get a file of their own: golden email
  ID + invented sender + expected outcome under R-14 to R-17, against invented
  mock ERP data; never derived from labels. One text serves several cases
  (E-06 from the order's owner, from another customer's contact, from an
  unknown address). Golden-set gap: no email has an order number without
  prefix that the customer calls an order (R-09 Stufe 2). Candidate E-23,
  added with the end-to-end eval; the gate then needs a new ten-run baseline.

## Mock ERP (Module 4.3)

Stands in for the company's ERP. Built in 4.3; our ERP client calls it from
4.5 on. Every fact below was checked in a scratch copy (Node 24.21.0, zod
4.5.4) or on Felix's Mac.

- Files: src/erp-contract.ts (the contract: Zod schemas for a customer, an
  order and the data file; imported by the mock and, from 4.5, by the client;
  10 tests in src/erp-contract.test.ts with invented records);
  mock-erp/data.json (the seed); mock-erp/data.test.ts (the seed against the
  contract, so `npm test` and CI catch a broken seed without starting the
  server); mock-erp/server.ts (`createMockErp(data)`, routes only, so tests can
  start it with data of their own); mock-erp/main.ts (`npm run erp`: checks
  data.json, refuses to start on a violation with exit code 1, listens on
  127.0.0.1:4100).
- Endpoints, read-only:
  - `GET /customers?email=<address>` → 200 the customer; 404 `no customer with
    this contact address`; 400 `query parameter email is required`.
  - `GET /orders/<orderNumber>` → 200 the order; 404 `no order with this
    number`.
  - Anything else → 404 `no such endpoint`. The different 404 texts let the
    client tell a missing record from a wrong base URL; whether it reads them
    is decided in 4.5.
  One record or 404, not a list: the contract allows at most one customer per
  address.
- No business rule in the mock: it answers like an ERP to our service
  account. The address match is exact (lowercasing the sender is R-14, our
  code), "A-" is never added (R-15, our code), and every order goes to every
  caller (R-16, our code). All from 4.4 on.
- Contract, Felix's decisions (4.3, by committing the recommendation): three
  order statuses, `in_progress` / `shipped` / `delivered` (POLICY.md's
  in Bearbeitung / versandt / geliefert; storniert and teilgeliefert have no
  rule that uses them); `promisedDeliveryDate` may be null (R-17: "einen
  zugesagten Liefertermin hat"); an address belongs to at most one customer
  (POLICY.md v1.5, Bekannte Lücken).
- Contract, method: one order shape per status (discriminated union: in
  progress has `shippedOn: null`, shipped and delivered have a date); dates
  `YYYY-MM-DD`; addresses in lower case; numbers in R-09's format; no
  customer number, address or order number twice; a field only where a rule
  uses it (no names, no order items).
- Seed: K-51320 (einkauf@ and l.vogt@kessler-fluidtechnik.example) owns
  A-44821 (in progress, promised 2026-11-06) and A-44100 (delivered, shipped
  2026-10-07). K-58047 (bestellung@wendt-maschinenbau.example) has no
  orders. Reasons: E-06 names both orders (A-44821 asked about and not yet
  shipped; A-44100 delivered, background under R-08, so the label leaves it
  out). Done-when: E-06 from a Kessler address → A-44821's status; from
  Wendt's → „Kein Auftrag mit dieser Nummer für diesen Kunden.“ The promise
  date serves R-17 both ways, depending on the lookup date passed in (a
  lookup on 2026-11-05: not overdue; on 2026-11-09: overdue). An unknown
  sender is by definition not in the file.
- What the seed covers: the client (4.5) and the end-to-end cases (4.7,
  4.8). The R-14 to R-17 situations are tested with in-memory fakes in vitest
  (4.4, 4.6). 4.8 adds the orders of the golden emails its cases use,
  together with those cases.
- Mock data and the golden set: a record must not change when a golden
  label changes. Order numbers from an email's text are allowed (the company's
  orders exist whatever we label); records derived from labels are not. No
  sender address is built from a signature, and POLICY.md's example customers
  are not reused. Names and numbers were checked against golden texts,
  labels, POLICY.md and tests.
- Zod 4.5.4: `z.iso.date()` rejects "23.10.2026" and "2026-02-30";
  `z.email()` accepts ASCII only, so `.lowercase()` (no A–Z) covers every
  address it accepts; a missing key fails `.nullable()`; parsed records come
  back in the schema's field order (`promisedDeliveryDate` before `status`).
- node:http (Node 24.21.0): `res.writeHead()` then `res.end(body)` sent
  `Transfer-Encoding: chunked`; `res.statusCode` + `res.setHeader()` +
  `res.end(body)` sent `Content-Length`. A second `listen` on a taken port
  throws EADDRINUSE (errno -48 on macOS, -98 on Linux). curl against a closed
  port exits with code 7 and prints no status. In zsh, a URL with `?` must be
  quoted (plain zsh: "no matches found").

## Open experiments

Each changes one thing and is judged per check against the current baseline
(Noise and comparing runs): the 3.7 ten runs until an experiment is adopted,
then that experiment's ten runs (CI, evals/baseline/). The target's result in
the 3.7 baseline is given as right/10. Module 5 of the roadmap runs three of
them, in this order: Prefix assignment, Unnamed numbers, Reason vs. request.
The others wait for the larger golden set (Module 6 onward).

- Sender premise: remove the claim in DEFAULT_SYSTEM that all senders are
  customers. Target: E-19 (all checks 10/10): only harm can be shown.
- Field rename: `requestedAction` → `requestStated`. Target: E-14
  (requestedAction 0/10).
- Null example: the `requestedAction` description gives "pure venting" as its
  null example; E-14 is a calm factual complaint. Replace the example. Target:
  E-14 (0/10). Run separately from the rename.
- Injection line: run with and without the embedded-instruction rule in
  DEFAULT_SYSTEM. Target: E-17 (intents 8/10, `other` instead of `complaint` 2×):
  only harm can be shown.
- Confidence threshold: move the 0.5 cut from schema prose into code. Checked
  in 3.7 on the stored baseline answers (no API): no cut-off separates right from
  wrong intents. Dropping intents below 0.6 gives 197 of 220 intents right
  (baseline 195, within noise); from 0.65 on, answers are left with no intent at
  all (R-04), from 0.8 on every E-17 and E-18 answer. Not run; reconsider when the
  golden set has more emails with wrong intents.
- Prompt language: German DEFAULT_SYSTEM against the English one. Whole set.
- Prefix assignment: run `assignByPrefix` on the model's numbers inside
  extractEmail. Target: E-21 (orderNumbers and customerNumbers 0/10). It can only
  fix Stufe 1 errors.
- Reason vs. request (R-04): say in the `intents` description that a fact which
  only explains another request is not an intent of its own. Targets: E-16
  (adds complaint; intents 0/10, also adds `other` in 3), E-18 (adds order_status;
  0/10).
- Unnamed numbers (R-09 Stufe 3): say in the number descriptions that a number the
  customer does not call an order or customer number is recorded in neither list.
  Target: E-07 (orderNumbers 0/10).
- Deadline extent: say in the `deadlineStated` description to quote the time
  together with the word that introduces it ("bis", "spätestens"). Target: E-12
  (deadlineStated 4/10, "30.04." 6×; counts from 9/10). E-08 (8/10, "Freitag" 2×)
  can only show harm.

## Deferred design questions

- `other` used as a hedge (E-16, E-17): sharpen prose, remove the enum value,
  or require a justification field. After 3.6. Seen in 3.7: E-16 adds `other` in 3
  of 10 runs; E-17 answers `other` instead of `complaint` in 2 of 10.
- Confidence as a review mark in the approval queue (Module 8): in the 3.7
  baseline every intent reported at 0.85 or higher was right and all 28 wrong ones
  were at 0.80 or lower, but 18 right reports (E-17, E-18) were below 0.85 too.
  The 0.85 line was read off the same data, so on new emails it is too
  optimistic. Whether the queue shows such a mark is Felix's decision there.
- Split "does this belong in the queue" from "what does the customer want"
  into two fields. After 3.6.
- Scheduled eval run: built in 3.8 (CI). Why: the push gate only answers "did my
  change break the known cases?". It cannot catch provider-side changes without a
  code change: an alias repointed to a new model, or infrastructure bugs behind a
  pinned model ID (precedent: Anthropic's Aug–Sep 2025 incident degraded API output
  without a model version change). Related check: all model IDs are pinned; no
  Gemini `-latest` or `-preview` IDs, and no pre-4.6 dateless Claude aliases such as
  `claude-sonnet-4-5`. From the 4.6 generation onward the dateless ID is the fixed
  snapshot.
- Gate false alarms (3.8): a check right in 10/10 can still fail now and then; the
  nightly runs measure how often. If more than one false alarm a month: confirm
  before turning red (re-run the failing email a few times inside the workflow, red
  only if the check fails again). Not a tolerance such as "164 of 165": it would
  miss every single-check break.
- Wobbling checks in CI (3.8): the 5 flaky checks are never judged in CI. Option:
  run only the wobbling emails ten times per push (about 17 cents) and judge them
  with the 3.7 table; catches large drops only. Reconsider when the golden set
  grows and the flaky group gets bigger.
- Workload identity federation for the CI key (3.8): short-lived tokens instead of
  a stored key. Needs our own token exchange, because the AI SDK does not do it
  (Stack facts). Module 12 (secrets management).
- `npm audit` findings in dev dependencies (3.8): 15 in promptfoo's tree, none
  reachable from our inputs. Module 9 (production concerns), together with a
  promptfoo upgrade as its own commit.
- Golden set size: 22 cases in Module 3. Expand when statistical resolution
  is needed (Module 6 onward), not before. 3.7: calibration and any confidence
  threshold need more emails with wrong intents; only four exist.
- Lookups for reply drafts (6b), each with the extraction field it needs, a
  POLICY.md rule for recording it, labels for the existing emails and a
  ten-run eval: getCustomerHistory (order questions and complaints without a
  valid order number, e.g. E-14); an invoice lookup (needs an invoice-number
  field: E-04 and E-22 name only an invoice, E-12 and E-18 also an order); a
  document lookup (needs a field for the requested document, e.g. E-15). Build
  one only if it teaches something the Module 4 lookups don't. POLICY.md
  Bekannte Lücken (since v1.4) records the business side.
- Reply drafting is Module 6b (added to the roadmap in 3.1 as Module 5b). The
  LLM-as-judge eval for drafts and the reply-language decision go with it.
- Does `requestedAction` earn its place in the approval queue UI? Module 8.
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
- The second annotator's material, byte for byte as downloaded:
  docs/second-annotator-3.3-prompt.md (the prompt, with the 22 email texts;
  POLICY.md and LABELLING.md were attached as files) and
  docs/second-annotator-3.3-answer.json (Gemini's answer, saved by AI Studio
  as "ai_studio_code (1).txt"). Checked 08.10.2026: the 22 texts are
  identical to src/golden/cases.ts, and the answer agrees with today's labels
  in 154/154 field comparisons (requestedAction present vs null), because all
  six differences below were resolved toward its reading. Records only:
  nothing reads them, and they never become prompt material (golden texts
  and answers; see Deferred design questions, POLICY.md's examples). When
  the step repeats (when the golden set grows, Module 6 onward), reuse this
  prompt with the golden set of that time, so the new agreement number
  compares with this one.
- The six fields that differed, each resolved by Felix in 3.3 toward the second
  annotator's reading:
  - decided by POLICY.md word for word: E-04 orderNumbers (an invoice number is
    not an order number, R-09), E-08 customerNumbers (the unprefixed "Kundennummer
    66017" is recorded as written, R-09 Stufe 2), E-11 requestedAction ("Können
    Sie mir dazu bitte Auskunft geben?" is a request, R-06);
  - judgment calls: E-02 intents → complaint (first label other), E-17 intents →
    complaint (first label other; Reklamation includes demanding an Erstattung),
    E-16 intents → cancellation only (first label also document_request; led to
    POLICY v1.3, which now decides it word for word).
    A model miss on the first three is a model error; on a judgment call it may be
    a blur case, where the policy leaves room.
- Every difference was resolved against POLICY.md. One of them (E-16) led
  to a policy clarification (v1.3). v1.2, the Kaufanfrage rename, came
  earlier, from reviewing LABELLING.md.
- The second annotator marked E-12 as uncertain: the demanded Gutschrift
  reads like Reklamation, but Reklamation excludes complaints about an
  invoice. Both annotators labelled `invoice_question`. Likely blur case in
  3.6. 3.7: the model added `complaint` in 3 of 10 runs.
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
- Seen in the 3.7 ten runs (eval-6y4), recorded after the predictions above:
  - Wrong in all ten: E-07 orderNumbers `["78432"]`; E-14 requestedAction
    invented; E-16 intents (adds `complaint`; also `other` in 3); E-18 intents
    (adds `order_status`); E-21 K-62418 in orderNumbers, customerNumbers empty.
  - Changed between runs: E-08 deadlineStated 8/10 ("Freitag" 2×); E-12 intents
    7/10 (adds `complaint` 3×); E-12 orderNumbers 8/10 (`[]` 2×); E-12
    deadlineStated 4/10 ("30.04." 6×); E-17 intents 8/10 (`other` instead of
    `complaint` 2×).
  - First seen in 3.7: `other` as a hedge (E-16, E-17) and a wrong intent in E-12,
    both not seen in the first runs.
  - Of the six fields disputed in 3.3, E-16 and E-17 intents are missed (E-17 is
    one of the judgment calls); E-02, E-04, E-08 and E-11 were right in all ten
    runs. E-12, which the second annotator marked uncertain, adds `complaint`.
