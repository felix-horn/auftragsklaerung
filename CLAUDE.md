# CLAUDE.md

## What this is
German B2B email triage ("Auftragsklärung"). Extraction → derived urgency →
(later) ERP tools, retrieval, evals, approval queue. Built module by module.

## Stack facts — verified, do not re-derive
- Structured output on Anthropic goes via `output_config.format.schema`. Not a
  synthetic tool, not `tools`/`tool_choice`. Verified by dumping the request body;
  see docs/request-body-reference.json.
- AI SDK 6: `generateText` + `output: Output.object()`. `generateObject` is deprecated
  and does not auto-retry on validation failure. Failures throw
  `NoObjectGeneratedError`.
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

## Observed numbers (20-email set, module-2 tag)
- Input: ~1890–2000 tokens per email
- Output: 75–484 tokens per email; reasoning tokens 0 on clean cases, 200–350 on
  hard ones
- All 20 schema-valid

## Commands
- `npm run extract` — runs the 20-email test set (src/run.ts)
- `DUMP_REQUEST_BODY=<path> npm run dump` — one API call, writes the exact wire payload
