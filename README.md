# Auftragsklärung

LLM-based triage of German B2B customer emails for a fictional industrial parts
supplier. A model records the facts of each email; code applies the business
rules and looks the orders up in an ERP. A versioned business specification, a
hand-labelled golden set and an eval gate in CI measure every change.

[![CI](https://github.com/felix-horn/auftragsklaerung/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/felix-horn/auftragsklaerung/actions/workflows/ci.yml)

**Kurz auf Deutsch.** Lernprojekt aus meinem selbst konzipierten Curriculum
„AI Integration Engineer“. Ein Sprachmodell ordnet die eingehenden E-Mails eines
fiktiven Zulieferers für Industrieteile ein und hält die Fakten fest: Anliegen,
Auftrags- und Kundennummern, Fristen, Eskalationsmerkmale. Regeln im Code leiten
daraus die Dringlichkeit ab und fragen das ERP ab; ein Kunde erhält dabei nur
Auskunft zu seinen eigenen Aufträgen. Die fachlichen Regeln stehen unabhängig
von jedem Prompt in [`docs/POLICY.md`](docs/POLICY.md). Ein Golden Set aus 22
E-Mails prüft das System bei jedem Push und jede Nacht in GitHub Actions.
Antwortentwürfe und die Freigabe durch eine Mitarbeiterin folgen in späteren
Modulen; nichts wird automatisch versendet.

## What it does today

| Step | Done by | What happens | Code |
|---|---|---|---|
| 1. Extraction | model, one request | Records the intents, order and customer numbers, the requested action, a stated deadline and escalation signals. Structured output, validated with Zod. | `src/extract.ts`, `src/schema.ts` |
| 2. Urgency of the message | code | low, medium or high, from the escalation signals and the deadline (R-13) | `src/urgency.ts` |
| 3. ERP lookup | code | Finds the customer by the sender address (R-14), looks up each recorded order number (R-15), shows only the sender's own orders (R-16) | `src/erp-stage.ts`, `src/erp-client.ts` |
| 4. Urgency after the lookup | code | Raised to at least medium for an overdue delivery promise or a cancellation before shipping (R-17) | `src/urgency.ts` |

`processEmail` in `src/process-email.ts` runs the four steps in order. R-xx are
rule IDs in [`docs/POLICY.md`](docs/POLICY.md). The eight intent categories:
order status, complaint, purchase inquiry, invoice question, cancellation,
document request, spam, other.

Planned (see [Status](#status)): retrieval over the company's terms, German
reply drafts, a human approval queue.

## One email through the pipeline

E-06 from the golden set:

> Guten Tag, die Lieferung zu Auftrag A-44100 kam letzte Woche vollständig an,
> vielen Dank dafür. Bei Bestellung A-44821 warten wir hingegen noch auf eine
> Versandbestätigung. Können Sie mir den Status nennen? MfG, R. Hoffmann

The extraction as the model returned it in 6 of the 10 baseline runs
(`evals/baseline/`):

```json
{
  "intents": [{ "type": "order_status", "confidence": 0.95 }],
  "orderNumbers": ["A-44821"],
  "customerNumbers": [],
  "requestedAction": "Status der Bestellung A-44821 mitteilen",
  "deadlineStated": null,
  "escalationSignals": []
}
```

A-44100 only gives context, so it is not recorded (R-08). There is no escalation
signal and no deadline, so the urgency of the message is low.

What the ERP lookup of A-44821 returns depends on who sent the email (mock ERP,
`04_module/try-erp-client.ts`):

| Sender | Result |
|---|---|
| `L.Vogt@kessler-fluidtechnik.example`, a contact of K-51320, which owns the order (case is ignored) | the order: in progress, delivery promised for 2026-11-06 |
| `bestellung@wendt-maschinenbau.example`, a contact of another customer | „Kein Auftrag mit dieser Nummer für diesen Kunden.“, the same answer as for an order that does not exist |
| `info@unbekannt.example` | „Absender ist keinem Kunden zugeordnet.“ |

Looked up on 2026-11-07 or later, the promise is overdue and the urgency after
the lookup rises to medium (R-17).

## Design decisions

- **The specification comes before the prompt.** `docs/POLICY.md` (German, v1.9)
  states the business rules in business terms, with stable rule IDs. The golden
  labels are derived from it, never from the system prompt, so rewording the
  prompt cannot move a label. The prompt is an implementation under test.
- **The model records facts; code makes the decisions.** Urgency and which ERP
  lookups run follow from recorded facts by fixed rules, so they are code with
  unit tests. No model calls the ERP and no ERP answer reaches the extraction,
  so the extraction can only record what the email says (R-01). Model-driven
  tool calling was built and compared first: over raw HTTP in Module 1, then
  with the AI SDK in `04_module/` (the loop by hand,
  the loop run by the SDK, a ReAct-style action field, tool choice settings),
  then rejected for this step. Reasons and rejected designs: `CLAUDE.md`,
  section "ERP stage".
- **Permissions are enforced in code, not in the prompt.** The requester is the
  registered sender address, never a customer number in the text. Another
  customer's order and a missing order get the same answer, so the answer does
  not reveal whether the order exists.
- **The ERP owns its contract.** Its OpenAPI document (`contracts/erp-api.json`)
  is the source. orval generates Zod schemas from it for our client and,
  separately, for the mock, so neither side imports the other's code. CI fails
  when generated code no longer matches the document. Every answer the client
  can't use (no connection, timeout, unexpected status, not JSON, a body that
  breaks the contract) reaches the clerk as „Auftragsbestand nicht erreichbar.“;
  developers get a report without the ERP's body, which holds customer data.
- **Variance is measured, not configured away.** claude-sonnet-5 thinks
  adaptively and rejects non-default sampling parameters, so the same email can
  come back differently. The baseline is ten runs, and a change is judged
  against it check by check.

## How it is measured

| | |
|---|---|
| Golden set | 22 German emails as typed TypeScript, Zod-validated on load, labelled from `POLICY.md` alone; each case records the policy version that decided it |
| Second annotator | Gemini in a fresh session with only `POLICY.md`, `LABELLING.md` and the email texts: 148 of 154 field labels agreed (96.1%) before reconciliation. This measures how clearly the policy decides, not the model. |
| Checks | 8 per email (schema validity and 7 fields), 176 per run |
| Ten runs of the unchanged pipeline (02.10.2026) | 145–148 of 154 field comparisons right per run; 15–17 of 22 emails with every field right; 165 of 176 checks right in all ten runs, 6 wrong in all ten, 5 varying |
| Cost | about 12.5 US cents per run of 22 emails, about 0.6 US cents per email (one request to claude-sonnet-5) |

The six checks that are wrong in every run are known. Each has a recorded
experiment in `CLAUDE.md` (Open experiments); Module 5 runs three of them.
`npm run eval:report` lists them.

**CI gate.** GitHub Actions runs on every push, every night and on demand:
generated code check, type check, unit tests, one eval run against the real API,
then the gate. The gate turns the build red when a check that was right in all
baseline runs is wrong, and gives no verdict on API errors or changed labels.
Checks that were wrong in some or all baseline runs are listed but never decide
a single run. Whether a change made the pipeline better or worse is a ten-run
comparison, judged per check with a fixed table from Fisher's exact test
(one-sided, α = 0.05). A CI run takes about a minute. Demonstrated on 07.10.2026
on a throwaway branch: removing one sentence from a schema field description
made E-10 report a requested delivery date as a response deadline, the urgency
followed, and the gate turned the build red.

## Status

As of 11.11.2026. Built module by module along a self-designed curriculum.

| Module | Content | Status |
|---|---|---|
| 1 | Raw `fetch` against the Anthropic and Gemini HTTP APIs, no SDK: the tool-call loop by hand, token accounting with EUR cost per request, the two providers' token fields compared | done, [first commit](https://github.com/felix-horn/auftragsklaerung/tree/1e3d49e9b46430655098593579184e0a4dbec240) |
| 2 | Structured outputs and schema design | done, tag `module-2` |
| 3 | Evals: `POLICY.md`, golden set, promptfoo, noise measurement, CI gate | done, tag `module-3` |
| 4 | The ERP: ways to use a tool, mock ERP, contract, permission rules, the pipeline end to end | in progress (step 4.7 of 4.9) |
| 5 | Prompt experiments, each judged against the ten-run baseline | next |
| 6 | Retrieval over the company's terms of delivery, returns and warranty: pgvector, hybrid search, recall@k | planned |
| 6b | German reply drafts; an LLM-as-judge rubric in CI | planned |
| 7 | Webhook ingestion, idempotency, retries, dead letters, fallback model | planned |
| 8 | Approval queue in Next.js: approve, edit or reject drafts; trace viewer; cost dashboard; edits become eval cases | planned |
| 9 | Prompt injection, DSGVO, EU AI Act, write-up | planned |
| later | Agent orchestration; an MCP server exposing the ERP functions as tools | planned |

## Repository layout

| Path | Role |
|---|---|
| `src/` | the application: pipeline, extraction, urgency rules, ERP stage and client, config |
| `evals/` | promptfoo config, custom provider, assertions, golden set, gate, ten-run baseline |
| `mock-erp/` | stand-in for the company's ERP: `node:http`, one JSON file of invented customers and orders, no business rules |
| `contracts/` | the ERP's OpenAPI document, owned by the (imagined) ERP team |
| `docs/` | `POLICY.md` and `LABELLING.md` (German), `EXPLANATIONS.md`, the second annotator's prompt and answer, the reference request body |
| `04_module/` | Module 4 teaching scripts: ways to use a tool, practice files |
| `CLAUDE.md` | project memory for Claude Code: conventions, verified stack facts, decisions with rejected alternatives, every measured number |

Where to read more: business rules in [`docs/POLICY.md`](docs/POLICY.md), how
they are applied to the golden set in [`docs/LABELLING.md`](docs/LABELLING.md),
why things are built this way in [`docs/EXPLANATIONS.md`](docs/EXPLANATIONS.md),
decisions and measured numbers in [`CLAUDE.md`](CLAUDE.md).

## Running it

Needs Node.js 24 (22.22 or newer works) and npm 11; npm 10 refuses `npm ci` on
this lockfile. An Anthropic API key is needed only for the commands that call
the API.

```sh
git clone https://github.com/felix-horn/auftragsklaerung.git
cd auftragsklaerung
npm ci
cp .env.example .env   # add ANTHROPIC_API_KEY for the API commands
```

| Command | What it does | API |
|---|---|---|
| `npm test` | unit tests (vitest) | no |
| `npx tsc --noEmit` | type check | no |
| `npm run golden:check` | validates the golden set | no |
| `npm run eval:report -- evals/baseline/eval-3.7-repeat10.json` | the ten-run baseline, check by check | no |
| `npm run erp`, then `npx tsx 04_module/try-erp-client.ts` in a second terminal | the mock ERP, and the ERP stage over HTTP for three senders | no |
| `npm run extract:golden-set` | extracts all 22 golden emails | 22 requests, about 12.5 US cents |
| `npm run eval` | one eval run, as in CI | 22 requests, about 12.5 US cents |
| `npm run eval -- --repeat 10` | ten runs, as for the baseline | 220 requests, about 1.25 US dollars |

`npm run eval` exits with code 100 whenever an email has a wrong check, which is
every run. The gate decides instead: `npm run eval -- -o eval-result.json`, then
`npm run eval:gate -- eval-result.json`.

## How it is built

Developed with Claude Code in VS Code. `CLAUDE.md` is what Claude Code reads
between steps, and it is kept true at every commit. Claude Code shows the diff;
I review it and commit.

## License

ISC, see [LICENSE](LICENSE).

## Contact

Felix Horn, Hamburg · [flx.horn@gmail.com](mailto:flx.horn@gmail.com) ·
[LinkedIn](https://www.linkedin.com/in/felix-horn)
