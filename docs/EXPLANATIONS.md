# Explanations

Answers about this project that are worth keeping: how its parts work and why they are built the way they are. Two uses: look something up here instead of asking again, and read the **In short** parts before talking about the project.

**How this file relates to the others**

| File | Answers |
|---|---|
| `docs/POLICY.md` | What is the right result for an email? The business rules, in German. |
| `docs/LABELLING.md` | How are those rules applied when labelling the golden set? In German. |
| `CLAUDE.md` | What was decided, measured and deferred, and how Claude Code should work in this repo. |
| `docs/EXPLANATIONS.md` | Why things are built this way, explained so it can be retold. |

Numbers and decisions have their home in `CLAUDE.md`. This file repeats some of them so that an entry can be read on its own, and every entry says when it was true. If this file disagrees with `CLAUDE.md` or the code, `CLAUDE.md` and the code are right, and this file needs updating.

**Every entry has**

- the question, as its heading;
- **In short**: a few sentences, about as long as you would say out loud;
- **In detail**: the full explanation, with examples;
- **As of**: the date, the module, and where the facts come from.

## Contents

- Words used in this file
- Evals
  1. What is promptfoo, and why do we use it?
  2. Why not just vitest?
  3. Why is `evals/` so big, and why does it need to be that complex?
- How entries get here

---

## Words used in this file

Some words mean two things in this project. This file always says which one.

| Word | Meaning here |
|---|---|
| golden set | The 22 German emails in `evals/golden/cases.ts`, each with its correct labels. |
| label | The correct value of one field for one golden email, decided from `POLICY.md` alone. |
| field | One part of the extraction. Seven are checked: `intents`, `requestedAction`, `orderNumbers`, `customerNumbers`, `escalationSignals`, `deadlineStated`, `urgency`. |
| eval run | One pass of all 22 golden emails through the pipeline: 22 API calls, about 12.5 US cents. |
| CI run | One run of the GitHub Actions workflow: type check, unit tests, one eval run, then the gate. |
| check | One assertion on one email. 22 emails × 8 assertions = 176 checks per eval run. |
| field comparison | One field check on one email. 22 emails × 7 fields = 154 per eval run. `schemaValid` is not counted (entry 3, part 2 says why). |
| baseline | Ten eval runs of the unchanged pipeline, stored in `evals/baseline/`. Every comparison is made against it. |
| gate | The step at the end of a CI run that compares its one eval run with the baseline and decides green or red. |
| provider (promptfoo) | The adapter promptfoo calls to get an answer: `evals/providers/extract-email.ts`. |
| provider (LLM) | The company whose model we call: Anthropic, or Google for Gemini. |
| prompt (promptfoo) | The template in `promptfooconfig.yaml`, `"{{email}}"`: the email text and nothing else. |
| prompt (model) | The instructions the model gets inside `extractEmail`: the system prompt and the schema descriptions. "Change a prompt" means this one. |
| test case (promptfoo) | One golden email with its labels, as promptfoo runs it. |
| test (vitest) | One `test(...)` block in a `*.test.ts` file. Never calls the API. |

---

## Evals

### 1. What is promptfoo, and why do we use it?

**In short.** promptfoo is a test runner for model calls. We give it the 22 golden emails with their labels. It sends each email through our real `extractEmail`, checks every field of the answer against its label, and stores every result. That gives one accuracy number per field, which we can repeat ten times, compare between versions of the pipeline, and use to fail a CI run.

**In detail**

Think of vitest with a model in the middle. vitest calls a function with an input and checks what comes back. promptfoo does the same, but the function calls a language model, so every eval run really calls the API and costs money.

The whole setup is in `evals/promptfooconfig.yaml`. Each key, and the file behind it:

| Key in the config | Our file | What it does |
|---|---|---|
| `providers` | `providers/extract-email.ts` | The adapter promptfoo calls for each test case. Ours calls the real `extractEmail`, so the system prompt, the schema and the AI SDK call are all part of what is measured, not only the prompt text. |
| `prompts` | `"{{email}}"` | What promptfoo hands the adapter: the email text and nothing else. The instructions for the model live inside `extractEmail`, not here. |
| `tests` | `golden-tests.ts` | Turns the 22 golden emails into 22 test cases. Each carries its labels as metadata. |
| `defaultTest.assert` | `assertions/schema-valid.ts`, `assertions/fields.ts` | Eight assertions, applied to every test case: one for the shape of the answer, one per field. |
| `metric` | `schemaValid`, `intents`, … | The name promptfoo counts an assertion's results under. That is what gives one accuracy number per field instead of one per email. |

What happens to one golden email:

```
golden-tests.ts
  one email + its labels
        │
        ▼
providers/extract-email.ts
  passes on the email text only
        │
        ▼
extractEmail (src/)
  system prompt + schema
  → Anthropic API
        │
        ▼
the extraction (JSON)
        │
        ▼
8 assertions
  each reads the labels
  from the test case
        │
        ▼
stored: 8 × pass or fail,
each with a reason
```

Who sees what:

- **The model sees the email and our instructions, never a label.** The adapter reads only the email text. The labels travel with the test case, and only the assertions read them.
- **The model never sees `POLICY.md` or `LABELLING.md`.** That is deliberate: the eval measures whether our prompt and schema capture the policy, not whether the model can copy from it.

What promptfoo gives us on top of making the calls:

- `--repeat 10`: the same 22 emails ten times in one eval (220 API calls, about 1.25 USD). Entry 3 explains why that matters.
- A count per metric, so accuracy per field is one division: the sum of the scores ÷ the number of test cases.
- An export of every result as JSON. The file in `evals/baseline/` is such an export.
- A web view with every failure and its reason.

Commands. The first two call the API, the third doesn't:

```bash
npm run eval
npm run eval -- --repeat 10
npx promptfoo view
```

**Recap in technical terms.** promptfoo is an LLM evaluation harness. We use a custom provider (`file://providers/extract-email.ts`) that wraps the production function, a golden dataset loaded as test cases with the labels in test metadata, and custom JavaScript assertions, each reporting a named metric. Accuracy per field is the metric's score sum divided by its count.

**As of** 04.11.2026, Module 4. Config as in the repo on that date. Costs: `CLAUDE.md` (Commands, Observed numbers).

---

### 2. Why not just vitest?

**In short.** We use both. vitest tests the code around the model: the comparison rules, `deriveUrgency`, the gate. That code gives the same answer every time and never calls an API. The extraction does neither: it calls the API, and with nothing changed its score moves between 145 and 148 of 154. Measuring that needs repeated runs, numbers per field and stored results, which is what promptfoo provides.

**In detail**

Unit tests follow three rules. An eval of a model breaks all three:

| Rule of a unit test | Why an eval breaks it |
|---|---|
| Never call the network. | The model is the thing being measured, so an eval has to call it. One eval run costs about 12.5 US cents. |
| Same input, same answer. | The model doesn't give the same answer twice. Ten eval runs of the unchanged pipeline got 148, 146, 145, 146, 145, 146, 148, 146, 147 and 148 of 154 field comparisons right. |
| Pass or fail as a whole. | An eval needs a number per field and per email, over many runs, stored so that a later version can be compared with it. |

The second row is the one that matters most. Think of a bathroom scale that shows a slightly different weight each time you step on it, even though you haven't changed. One reading tells you little; you would only trust a difference bigger than the scale's wobble. The eval is that scale, and its wobble is three field comparisons (145 to 148).

**Which question goes where.** The separating question: does answering it need the model?

| Question | Tool | Why |
|---|---|---|
| Does `hasSameItems` treat `["A", "B"]` and `["B", "A"]` as the same list? | vitest | pure code, same answer every time |
| Does `deriveUrgency` give the urgency `POLICY.md` asks for? | vitest | pure code; tested against all 22 golden urgency labels |
| Does the gate turn red when a guarded check fails? | vitest | `gate.test.ts` uses invented emails (E-91, E-92), no API |
| Does the model find the order number in E-07? | promptfoo | needs the model; in the baseline it never does (0 of 10 runs) |
| Did this prompt change break something? | promptfoo and the gate | needs the model and a comparison with the baseline |

The split also tells you where a failure comes from. The `urgency` check in the eval runs `deriveUrgency` on the model's answer. Because `deriveUrgency` itself is already tested with vitest on the golden labels, a wrong urgency in an eval run points at the model's escalation signals or deadline, not at the function.

The vitest files in `evals/` test the measuring instrument itself: `golden/compare.test.ts`, `golden/deadline.test.ts`, `assertions/fields.test.ts` and `gate.test.ts`, 414 lines together. They run with `npm test`, cost nothing, and run in every CI run before the eval run.

**Recap in technical terms.** Unit tests cover deterministic, pure functions; an eval measures a non-deterministic component. Evaluating it needs repeated trials, per-metric aggregation and persisted results. Keeping the business rules out of the model and unit-testing them separately lets a failure be traced either to the model's output or to the rule applied to it.

**As of** 04.11.2026, Module 4. Run totals: `CLAUDE.md` (Observed numbers, the Module 3.7 ten runs).

---

### 3. Why is `evals/` so big, and why does it need to be that complex?

**In short.** It is about 1,700 lines of code and labels plus one 67,000-line data file: the stored baseline of ten eval runs. The code is that size because the model doesn't give the same answer twice. Besides the golden set there are rules for what counts as right, assertions that count a broken answer as wrong instead of dropping it, a report that sorts every check into stable, always wrong or wobbling, and a CI gate that turns red only when a check that was right in all ten baseline runs fails. Without these, CI would either go red at random or miss real breaks.

**In detail**

**The line counts**, from `wc -l` on every file in `evals/` on 04.11.2026:

| Part | Files (lines) | Lines |
|---|---|---|
| Stored data | `baseline/eval-3.7-repeat10.json` | 67,000 |
| Golden set | `golden/cases.ts` (350), `golden/case-schema.ts` (115), `golden/check.ts` (12) | 477 |
| promptfoo wiring | `promptfooconfig.yaml` (36), `golden-tests.ts` (21), `providers/extract-email.ts` (39) | 96 |
| What counts as right | `golden/compare.ts` (24), `golden/deadline.ts` (27) | 51 |
| Assertions | `assertions/fields.ts` (119), `assertions/schema-valid.ts` (16) | 135 |
| Report | `report.ts` | 265 |
| Gate | `gate.ts` (197), `gate-cli.ts` (87) | 284 |
| Tests of the eval code | `golden/compare.test.ts` (70), `golden/deadline.test.ts` (121), `assertions/fields.test.ts` (88), `gate.test.ts` (135) | 414 |
| **Total** | | **68,722** |

Leave out the data file and 1,722 lines remain, a quarter of them tests (414).

**What exists only because of the noise.** If the model gave the same answer every time, one eval run would be the truth. You would need the golden set, the wiring, the comparison rules and the assertions: 759 lines, plus their tests. The report, the gate and the baseline file (549 lines of code and the 67,000-line export) exist only because the model's answers vary.

The rest of this entry goes through the four parts that do the work. Each answers one question.

#### Part 1: What counts as right?

Files: `golden/compare.ts`, `golden/deadline.ts`, and the per-field comparisons in `assertions/fields.ts`.

Comparing the model's answer with the label looks trivial. It isn't, because a comparison can be wrong in two directions, and neither shows up as an error:

- **Too strict:** a right answer counts as wrong. Accuracy looks lower than it is, and experiments try to fix problems that don't exist.
- **Too loose:** a wrong answer counts as right. Accuracy looks higher than it is, and a real break passes the gate.

Every number the eval produces goes through these rules. That is why the 51 lines in `compare.ts` and `deadline.ts` have 191 lines of tests.

**Lists: order doesn't matter, duplicates do.** Four fields are lists: `orderNumbers`, `customerNumbers`, `escalationSignals` and `intents`. They are compared with `hasSameItems`, which sorts both lists and then compares them item by item. Examples, with invented values:

| Label | Model's answer | Result | Why |
|---|---|---|---|
| `["A-44821", "A-44907"]` | `["A-44907", "A-44821"]` | right | Same numbers, different order. Comparing position by position would call this wrong. |
| `["A-44821", "A-44907"]` | `["A-44821"]` | wrong | One number is missing. |
| `["A-44821"]` | `["A-44821", "A-44821"]` | wrong | A duplicate. Comparing them as sets would call this right, because a set keeps each value once. |
| `[]` | `[]` | right | The email has no order number, and the model found none. |
| `[]` | `["A-50112"]` | wrong | The model reported a number the label doesn't have. |

Why duplicates count: a label can never contain one (`case-schema.ts` rejects it when the golden set loads), so an answer with a duplicate is not the list the policy describes. A set comparison would hide that.

**Intents: compared by type, at any confidence.** The model returns each intent with a confidence, for example `{ type: "complaint", confidence: 0.9 }`. The labels have types only. `intentTypes` keeps the type of every intent the model returned and drops the confidence; then `hasSameItems` compares the two lists. No confidence cut-off is applied. Examples, invented:

| Label | Model's answer | Result |
|---|---|---|
| `["cancellation", "complaint"]` | complaint 0.9, cancellation 0.7 | right |
| `["complaint"]` | complaint 0.9, cancellation 0.3 | wrong: the low-confidence `cancellation` still counts as part of the answer |
| `["order_status"]` | complaint 0.8 | wrong |

Confidence was measured on its own in Module 3.7. No cut-off separated right from wrong intents well enough to act on.

**Deadlines: presence first, then wording.** `deadlineStated` is the model's word-for-word quote of a deadline for a response, or `null`. It is compared in two steps:

1. **Does each side have a deadline?** If one has and the other doesn't, the check is wrong, and the wording isn't looked at. A missed or invented deadline changes the urgency (`POLICY.md` R-13).
2. **Only if both have one: does the wording match?** `normaliseDeadline` first evens out small differences in how the text is written, as plain text (it doesn't turn the deadline into a date). `deadlineQuoteMatches` then compares by containment, not equality: the model is told to quote word for word, but not how much, so its quote may be a few words longer or shorter than the label's. The exact rule and its cases are in `deadline.ts` and `deadline.test.ts`; `CLAUDE.md` (Eval comparison) records why.

Examples for step 1:

| Label | Model's answer | Result |
|---|---|---|
| `null` | `null` | right: neither has a deadline |
| a deadline | `null` | wrong: missed. The urgency may come out too low. |
| `null` | a deadline | wrong: invented. The urgency may come out too high. |
| a deadline | a deadline | go on to step 2 |

A real case of an invented deadline: on 07.10.2026, on a throwaway branch, removing one sentence from the `deadlineStated` schema description made E-10 report its requested delivery date as a response deadline. The urgency followed, and the gate turned the CI run red.

**Two fields are compared differently on purpose.**

- **`requestedAction` is compared as present or absent only.** A label with an action and an answer with any action is right. A label without one and an answer with one is wrong. The wording isn't compared, so an invented detail inside a stated action passes; `CLAUDE.md` records this gap in its rule coverage.
- **`urgency` is not something the model answers.** The check runs `deriveUrgency` on the model's escalation signals and deadline and compares the result with the label. So it measures what the approval queue would show. A wrong deadline can therefore fail two checks at once, as it did for E-10.

#### Part 2: How is a broken answer counted?

Files: `assertions/fields.ts`, `assertions/schema-valid.ts`.

An **assertion** is a function promptfoo calls with one answer. It returns pass or fail and a reason, for example `got ["A-44821"], expected ["A-44821","A-44907"]`. Each email gets eight: `schemaValid` for the shape of the answer, and one per field. All seven field assertions are built by one wrapper, `fieldAssertion`, which does two checks before any field is compared. Because every field goes through it, no field can skip them.

**The separating question: does the problem say something about the pipeline, or about our own setup?**

- **Pipeline → FAIL.** The model's answer isn't a valid extraction. For example, it returned `"intents": []`, the AI SDK rejected it, and the adapter passed the raw text on. That is a measured result. Every field check returns "wrong" with the reason `no valid extraction`, and the email stays in every count.
- **Our setup → ERROR.** The labels are missing, for example because the metadata line was deleted from `golden-tests.ts`. Nothing about the model can be measured then, so the check throws on purpose and promptfoo marks the test case ERROR.
- **Also our setup → ERROR, for every test case:** an export name in the config is misspelt (`fields.ts:intent` instead of `fields.ts:intents`). `tsc` doesn't catch that.
- **No answer at all → ERROR:** an API call that fails gives the assertions nothing to check.

**Why the difference matters.** promptfoo counts each metric as the sum of the scores divided by the number of test cases that have a result. An ERROR test case has no result in any metric, so it drops out of every count. An invented example: the model breaks on the 2 hardest of the 22 emails and gets every field of the other 20 right.

| How the 2 broken answers are counted | `intents` accuracy |
|---|---|
| FAIL, as we do | 20 of 22 = 90.9% |
| ERROR, if the check threw | 20 of 20 = 100% |

Counted as ERRORs, a model that breaks on the hardest emails would look perfect. That is why a broken answer is returned as a failure and never thrown.

Two rules follow, recorded in `CLAUDE.md`:

- Per-field numbers count only from an eval with 0 ERRORs.
- After an ERROR, run the whole eval again (about 12.5 US cents) instead of re-running the one test case. Re-running one case creates a second eval, and the two would have to be added up by hand.

**Why keep `schemaValid` when the field checks already fail on a broken answer?** It is the only check that says *why* the answer was broken, and its own number separates "the answer was broken" (all seven fields wrong at once) from "one field was wrong". It is left out of the 154 field comparisons because it has no label, and a broken answer already shows up as seven failed field checks. In the ten baseline runs it was right 220 of 220 times.

#### Part 3: What changed across ten runs?

File: `report.ts`.

promptfoo adds results up per metric: after ten runs, the `intents` box shows one number out of 220. It doesn't show which email changed. `report.ts` reads a ten-run export and, for each of the 176 checks, counts in how many of the ten runs it was right. Then it sorts each check into one of three groups:

| Group | Meaning | In the Module 3.7 baseline |
|---|---|---|
| stable | right in all ten runs | 165 checks |
| known failure | wrong in all ten runs | 6 checks, for example E-07 `orderNumbers` (right 0 of 10) |
| wobbling | sometimes right, sometimes wrong | 5 checks, in E-08, E-12 and E-17; for example, in 3 of the 10 runs the model added the intent `complaint` to E-12 |

**Why a total can't judge an experiment.** Two reasons:

- **A single total is inside the noise.** Suppose a prompt change scores 148 in one eval run. That proves nothing: the unchanged pipeline also scored 148, in runs 1, 7 and 10.
- **A total can hide a trade.** An invented example: a change fixes E-07 `orderNumbers` and breaks E-02 `intents`. The total stays the same; the report shows one check going up and one going down.

So an experiment is ten runs before against ten runs after, judged check by check. For each check, the question is: if the change had done nothing, how likely is a split at least this lopsided, by chance alone? Below 5 %, the difference counts as real. That test is Fisher's exact test, one-sided, at the 5 % level. Its verdicts for ten runs against ten are written down once, as a fixed table in `CLAUDE.md` (Noise and comparing runs), so during an experiment they are looked up, not computed. Examples from that table:

| Baseline | After the change | Verdict |
|---|---|---|
| right 10 of 10 | right 6 of 10 | harmed |
| right 10 of 10 | right 7 of 10 | could be chance |
| right 0 of 10 (E-07 `orderNumbers`) | right 4 of 10 | fixed |
| right 8 of 10 | right 3 of 10 or fewer | harmed (4 or more could be chance) |
| right 7 of 10 | right 5 of 10 | can't tell; it would need more runs |

`report.ts` calls no API; it only reads an export:

```bash
npm run eval:report -- <export.json>
```

#### Part 4: Did my change break something I didn't intend?

Files: `gate.ts`, `gate-cli.ts`, `baseline/`.

This is the part that answers that question. On every push to any branch, every night and on demand, a CI run does a type check, the unit tests, one eval run (22 API calls, about 12.5 US cents) and then the gate. A CI run takes about a minute.

**Why not a simple threshold.** The obvious rule is "red when fewer than N field comparisons are right". Both ways of choosing N fail. Using the ten real totals (148, 146, 145, 146, 145, 146, 148, 146, 147, 148):

- **"Red below 148":** seven of the ten unchanged runs would have been red. CI would go red at random, and people learn to ignore a red build.
- **"Red below 145":** never red by chance. But the best the unchanged pipeline scored was 148, so a change that breaks three checks that never failed before can land at 145 and stay green.

**The rule the gate uses instead:** did a check fail in this eval run that was right in every baseline run? 165 checks were right in all ten baseline runs; those are the guarded ones. For every check that is wrong in the eval run:

| In the baseline, the check was | Gate |
|---|---|
| right in every run | red: a guarded check broke. This is what happened with E-10 on 07.10.2026. |
| wrong in every run (a known failure, such as E-07 `orderNumbers`) | listed, doesn't decide |
| sometimes right (wobbling) | listed, doesn't decide; only the ten-run comparison from part 3 can judge it |

**What `judge` in `gate.ts` does, in order:**

1. Any ERROR → no verdict. An ERROR has no answer, so its checks have nothing to judge.
2. More than one result per email → no verdict. The gate judges one eval run; ten runs are compared with the table from part 3.
3. Emails or labels that differ from the baseline's → no verdict. The baseline was graded against something else, so "right in every baseline run" no longer means anything. The baseline has to be run again first.
4. For each of the 176 checks, count in how many baseline runs it was right. Several baseline files are added together.
5. Sort every wrong check of the eval run into the list that turns the CI run red or the list that is only shown.

The exit code carries the verdict to GitHub: `0` green, `1` red, `2` no verdict. GitHub only tells `0` apart from everything else; the different numbers help when reading the log.

**Why two files.** `gate.ts` reads nothing and prints nothing; it only returns a verdict, so `gate.test.ts` can test it with invented emails (E-91, E-92) and no API. `gate-cli.ts` reads the files, calls `judge`, prints the result and sets the exit code.

```bash
npm run eval:gate -- <export.json>
```

**Why the baseline is a 67,000-line file.** It is the complete promptfoo export of the ten baseline runs: 220 answers, each with its email, its labels, the model's answer and all eight assertion results. The gate needs two things from it: how often each check was right (step 4), and which emails and labels the baseline was graded against (step 3). That is also why the labels travel as test metadata: a stored export then records what it was graded against.

**Why `baseline/` is a folder, not one file.**

- **A red CI run with no code changed.** Run the ten-run comparison by hand. If the table says "not harmed" (say the check comes out right 9 of 10), the pipeline is the same, so that export goes into `evals/baseline/` as a second file. The gate then counts 20 runs; the check is right in 19 of 20 and is no longer guarded.
- **An experiment is adopted.** Its ten-run export replaces everything in the folder, because the old files measured a different pipeline.

So the gate gets stricter as fixes land: a check that is right in every run of a new baseline becomes guarded.

**What one eval run can't promise.** A drop in one of the 5 wobbling checks doesn't fail the build; only a ten-run comparison can show it. And a red CI run is a reason to look, not proof: a guarded check can be wrong once by chance, which is the first case above. Repeating only the wobbling emails in every CI run (E-08, E-12 and E-17, ten times each: 30 extra API calls, about 17 US cents) would catch large drops there. It is parked in `CLAUDE.md` (Deferred design questions) until the golden set grows.

**Recap in technical terms.** The golden dataset is schema-validated on load. The equivalence rules are an order-insensitive multiset comparison for lists, presence-then-containment for quoted spans, presence only for free text, and a derived field recomputed from the model's output. Harness errors are kept apart from model failures, so failures never leave the denominator. Repeated trials classify every check as stable, consistently failing or flaky, and experiments are judged per check with Fisher's exact test. The CI gate is a regression gate against a stored baseline that guards only checks with a perfect baseline record: a ratchet that tightens as fixes are adopted, with flaky checks quarantined from the verdict.

**As of** 04.11.2026, Module 4. Line counts: `wc -l` in `evals/` on that date. Baseline numbers: `CLAUDE.md` (Observed numbers; Noise and comparing runs). Gate behaviour: `CLAUDE.md` (CI) and `evals/gate.ts`. The E-10 demonstration: the roadmap, Module 3.

---

## How entries get here

Entries start as questions asked in a chat or in Claude Code. Before an answer goes in, its facts are checked against the repo and `CLAUDE.md`. A new question goes under its topic; a question that is already here is merged into the existing entry rather than added twice. When the code or a number changes, the affected entry is rewritten and gets a new **As of** line.
