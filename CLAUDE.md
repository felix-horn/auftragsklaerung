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

## Observed numbers (20-email set, module-2 tag)
- Input: ~1890–2000 tokens per email
- Output: 75–484 tokens per email; reasoning tokens 0 on clean cases, 200–350 on
  hard ones
- All 20 schema-valid

## Commands
- `npm run extract` — runs the 21-email test set (src/run.ts)
- `DUMP_REQUEST_BODY=<path> npm run dump` — one API call, writes the exact wire payload

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

## Deferred design questions
- R-09 prefix classification as a pure function (3.4): the model extracts
  identifiers as written, code decides which array they belong in. Changes the
  system under test — measure before and after wiring it in.
- Deadline normaliser (3.4): its job is string tolerance ("bis Freitag" =
  "Bis Freitag."). Calendar resolution is impossible: the emails carry no sent
  date, and POLICY R-12 anchors deadlines to the time of writing.
- Assertion coverage (3.6): map each POLICY rule to the assertion that checks
  it. R-02 (German free text) currently has none, because `requestedAction` is
  only asserted null vs non-null.
- `other` used as a hedge (E-16, E-17): sharpen prose, remove the enum value,
  or require a justification field. After 3.6.
- Split "does this belong in the queue" from "what does the customer want"
  into two fields. After 3.6.
- Golden set size: 22 cases in Module 3. Expand when statistical resolution
  is needed (Module 5 onward), not before.
- Unprefixed identifiers recorded as written (R-09 step 2) get normalised at
  the ERP lookup. Module 4.
- Reply drafting is Module 5b (added to the roadmap in 3.1). The LLM-as-judge
  eval for drafts and the reply-language decision go with it.
- Does `requestedAction` earn its place in the approval queue UI? Module 7.
- `src/run.ts` comments are the 3.1 readings and still say `new_inquiry`
  (renamed to `purchase_inquiry` in POLICY v1.2). Read them as
  `purchase_inquiry`. Left unchanged on purpose: they are the third reading
  in 3.3 step 4 and must not be edited or displayed before the golden set is
  labelled. They go away when run.ts imports its emails from the golden set.
