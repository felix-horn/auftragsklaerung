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
- Code values live in two places that nothing links: the enums in
  src/schema.ts and the mapping tables in docs/LABELLING.md (section
  Zuordnung). After renaming an enum value, update LABELLING.md by hand.
  src/golden/cases.ts needs no reminder: it imports the enums and fails to
  load on a stale value.

## Observed numbers (20-email set, module-2 tag)
- Input: ~1890–2000 tokens per email
- Output: 75–484 tokens per email; reasoning tokens 0 on clean cases, 200–350 on
  hard ones
- All 20 schema-valid

## Commands
- `npm run extract` — runs the 22 golden-set emails (src/golden/cases.ts) through the extractor
- `npm run golden:check` — validates the golden set and reports how many cases are labelled
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
