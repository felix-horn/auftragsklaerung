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

Entry numbers are IDs, like the rule IDs in `POLICY.md`: they are never renumbered, so a new entry under an older topic takes the next free number.

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
  6. What does the baseline do, and how is it updated after a change?
- Golden set
  4. What is the difference between `POLICY.md` and `LABELLING.md`?
- Extraction
  5. How do we make sure the model's answer fits the schema?
- How entries get here

---

## Words used in this file

Some words mean two things in this project. This file always says which one.

| Word | Meaning here |
|---|---|
| golden set | The 22 German emails in `evals/golden/cases.ts`, each with its correct labels. |
| label | The correct value of one field for one golden email, decided from `POLICY.md` alone. |
| rule | One numbered business rule in `POLICY.md`, such as R-12 (Fristen). Its ID is never renumbered or reused. |
| convention | One instruction in `LABELLING.md` on how to write a label down. It never decides what the label is. |
| annotator | Whoever labels the golden set: Felix, and in Module 3.3 a second annotator, Gemini, in a fresh session with only `POLICY.md`, `LABELLING.md` and the emails. |
| field | One part of the extraction. Seven are checked: `intents`, `requestedAction`, `orderNumbers`, `customerNumbers`, `escalationSignals`, `deadlineStated`, `urgency`. |
| Zod schema | `emailExtractionSchema` in `src/schema.ts`: the full definition of an extraction, including rules that JSON Schema can't express. |
| JSON Schema | A standard format for describing JSON. The AI SDK converts the Zod schema into it, and that copy is what Anthropic receives. |
| token | The unit a model writes in: a word or a piece of one. |
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

**Why keep `schemaValid` when the field checks already fail on a broken answer?** Its own number separates "the answer was broken" (all seven fields wrong at once) from "one field was wrong". It was also meant to say *why* an answer was broken, but it can't: after a schema failure the adapter passes the model's raw text on as a string, so its reason is always `Invalid input: expected object, received string`. That is a known limit, noted at the end of Module 3.8 but not in `CLAUDE.md`. The real reason is in the AI SDK's error (entry 5). `schemaValid` is left out of the 154 field comparisons because it has no label, and a broken answer already shows up as seven failed field checks. In the ten baseline runs it was right 220 of 220 times.

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

The whole table, and the steps of an experiment, are in entry 6.

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

### 6. What does the baseline do, and how is it updated after a change?

**In short.** The baseline is ten eval runs of the unchanged pipeline. It answers two different questions with two different tools. The CI gate asks "did a check break that never broke before?": it guards the 165 of 176 checks that were right in all ten runs, from one eval run. An experiment asks "did my change make a check better or worse?": it runs ten times and compares each check with its ten baseline runs, using a lookup table worked out once with Fisher's exact test. The table exists because intuition fails here: 4 of 10 after 0 of 10 is a real fix, but 7 of 10 after 4 of 10 happens by chance almost one time in five. When a change is adopted, its ten runs replace the baseline in the same commit.

**In detail**

**What the baseline holds.** One promptfoo export, `evals/baseline/eval-3.7-repeat10.json`: ten runs of all 22 golden emails, made on 02.10.2026 in Module 3.7. For each of the 176 checks (one assertion on one email), it gives how often that check was right:

| Group | Checks | Which |
|---|---|---|
| right in all 10 runs | 165 | everything not listed below |
| wrong in all 10 runs | 6 | E-07 `orderNumbers`, E-14 `requestedAction`, E-16 `intents`, E-18 `intents`, E-21 `orderNumbers`, E-21 `customerNumbers` |
| sometimes right | 5 | E-08 `deadlineStated` 8/10, E-12 `intents` 7/10, E-12 `orderNumbers` 8/10, E-12 `deadlineStated` 4/10, E-17 `intents` 8/10 |

The unit is a check, not a field. No field is left out as a whole. `orderNumbers`, for example, is right in all ten runs on 19 emails and is guarded there; only on E-07, E-12 and E-21 is it not.

**Tool 1: the CI gate.** One eval run after every push and every night. The gate grades all 176 checks, as every eval run does, and sorts every wrong one:

| The check is wrong now, and in the baseline it was | Gate |
|---|---|
| right in all 10 runs (one of the 165) | red |
| wrong in all 10 runs | listed in the log, doesn't decide |
| sometimes right | listed in the log, doesn't decide |

So the 11 are checked in every CI run and shown, but they can't turn it red. The rule is that simple on purpose. Entry 3, part 4, explains why a threshold on the total can't work instead.

What the gate can't see:

- **A wobbling check getting worse.** Say a change takes E-17 `intents` from 8 of 10 to 4 of 10. Most CI runs stay green, because a wrong E-17 `intents` is normal wobble.
- **An improvement.** If E-07 `orderNumbers` started coming out right, nothing would happen.

Both need tool 2.

**Tool 2: the ten-run comparison, for experiments.** An experiment changes one thing, such as one sentence in the system prompt, runs the eval ten times, and compares each check with the baseline. The question per check: if the change had done nothing, how likely is a difference at least this big, by chance alone? If that is less than 1 time in 20, it counts.

Why that question needs a calculation, with real baseline numbers and invented experiment results:

| Check | Baseline | Experiment | How often chance alone does this | Counts? |
|---|---|---|---|---|
| E-07 `orderNumbers` | 0/10 | 4/10 | 4.3 % | yes: fixed |
| E-07 `orderNumbers` | 0/10 | 3/10 | 10.5 % | no |
| E-12 `deadlineStated` | 4/10 | 10/10 | 0.5 % | yes: fixed |
| E-12 `deadlineStated` | 4/10 | 7/10 | 18 % | no, although 7 is clearly more than 4 |
| E-08 `deadlineStated` | 8/10 | 10/10 | 24 % | no, although 10/10 looks perfect |

How the first row is worked out. Put the 20 results in a bag: 4 right, 16 wrong. If the change did nothing, it is luck which 10 of them belong to the experiment. The chance that all 4 right ones land in the experiment's 10 is 10/20 × 9/19 × 8/18 × 7/17 = 4.3 %. That way of counting is Fisher's exact test.

**You never do that calculation.** It was done once, in Module 3.7, for every possible pair of "baseline right k of 10" and "experiment right k of 10". The result is a table in `CLAUDE.md` (Noise and comparing runs), and using it means looking up two numbers:

| Baseline right | Counts as better from | Counts as worse at |
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

"–" means no result counts. Three rows to read carefully:

- **0/10:** a check the model never got right counts as fixed from 4 of 10. Most planned experiments aim at such checks.
- **7/10 to 9/10:** ten runs can't prove an improvement. It would take about 25 runs on each side. Experiments on these checks can only show harm.
- **10/10:** an always-right check counts as harmed only at 6 of 10 or below. One to three misses can't be told apart from chance, so their answers get read, but they don't decide.

**The two tools side by side:**

| | CI gate | Ten-run comparison |
|---|---|---|
| Question | Did a check break that never broke? | Did this change make a check better or worse? |
| Runs | 1 (22 API calls, about 12.5 US cents) | 10 (220 API calls, about 1.25 USD) |
| When | every push, every night | by hand, for each experiment and after a red CI run |
| Judges | the 165 guarded checks | every check |
| Rule | wrong now, right in every baseline run → red | the table |
| Code | `evals/gate.ts`, `evals/gate-cli.ts` | none: `evals/report.ts` gives the counts, the table is in `CLAUDE.md` |

**Why the code is still the size it is.** The last row matters: the part that sounds complicated, Fisher's exact test, is no code at all. The code goes into getting the counts right and into refusing to judge when a comparison would be wrong. Each piece guards against a verdict that would look fine and be wrong:

| Piece | What would go wrong without it |
|---|---|
| reading the promptfoo export with a Zod schema (`gate.ts`, `report.ts`) | A promptfoo upgrade changes the export format, and the gate could find no wrong checks and say green. With the schema, it fails loudly. |
| no verdict when any email is an ERROR | An API failure on 5 emails leaves them without results. Without the refusal, they hold no wrong check, so the run looks green. |
| no verdict when an email has more than one result | Someone passes a ten-run export to the gate. It would judge ten runs as if they were one. |
| no verdict when emails or labels differ from the baseline's | A label is corrected after the baseline was made. The baseline's "right in 10 of 10" was graded against the old label, so it means nothing for the new one. |
| adding up several baseline files | Needed after a false alarm (below): the red run's own result must be able to join the baseline. |
| listing every wrong check with the model's answer and the label | A red run should show at once what broke, without opening the export. |
| `gate.test.ts`, 135 lines | Each rule above is pinned by a test, so a later edit can't quietly remove it. |
| `report.ts`, 265 lines | The counts per check that the table needs, the totals per run, and the intent confidences next to the labels (the Module 3.7 confidence check). promptfoo's view shows none of these per email over ten runs. |

**When the baseline changes, and how.** Four situations. Only the second and third replace the baseline.

**A. A change that shouldn't change any answer,** such as a refactor, a new test or a comment outside the prompt.

1. Push. CI runs against the current baseline.
2. Green: done. Red: your change is the first suspect. Read the failed check and the model's answer in the log; if the change can't have caused it, treat it as D.

A change to the system prompt, `src/schema.ts` or a generation parameter never belongs here, however small, even a typo fix in a `.describe()` sentence. Each of those is prompt text (entry 5), so it goes through B.

**B. A change meant to improve answers: an experiment.**

1. On a branch, make one change. Fix its wording before the run. A rule goes in general words, taken from `POLICY.md`; never golden-email text or `POLICY.md` examples, or the experiment measures copying.
2. Dump the request body and diff it, so you know exactly what changed on the wire:

```bash
DUMP_REQUEST_BODY=docs/request-body-reference.json npm run dump
git diff docs/request-body-reference.json
```

3. Push the branch. The CI run compares one run against the old baseline. If it is red, a guarded check broke, and you know before spending 1.25 USD.
4. Run the eval ten times, with 0 ERRORs, and export it:

```bash
npm run eval -- --repeat 10
```

5. Get the counts per check from that export:

```bash
npm run eval:report -- <export.json>
```

6. Judge the target checks with the table: better, or not shown.
7. Look for side effects: every check that was 10/10 in the baseline and isn't now gets its answers read. At 6/10 or below, it counts as harmed.
8. Adopt or reject. Adopt: one commit on `main` with the change, the new request-body reference, the experiment's ten-run export **replacing** everything in `evals/baseline/`, and the result in `CLAUDE.md` (Open experiments). The CI run of that commit then compares against the new baseline. Reject: record the result in `CLAUDE.md` and drop the branch; the baseline stays.

Why replace, not add:

- **The old runs measured a different pipeline.** Mixed in, they blur both. An invented example: the change makes E-07 `orderNumbers` right in 10 of 10. Added to the old baseline, it would be right in 10 of 20, so it wouldn't be guarded, and the next break of E-07 would go unnoticed. Replaced, it is 10 of 10, guarded from now on.
- **The next experiment must change one thing.** Compared with the old baseline, it would measure two changes at once, its own and the adopted one.

That is also how the gate gets stricter over time: every check a fix brings to 10 of 10 joins the guarded ones. A fix that only reaches, say, 7 of 10 makes that check wobbling: better, but not guarded.

**C. A change to the golden set: a label or an email.** For example, a `POLICY.md` change that moves a label, or a new golden email such as the E-23 Module 4 plans.

1. The order is fixed: `POLICY.md` first, with a version bump; then the label; never the other way round.
2. The gate now gives no verdict (exit code 2), because the baseline was graded against other labels or emails.
3. Run the unchanged pipeline ten times against the new golden set and let that export replace `evals/baseline/`, in the same commit as the label or email change.

**D. Red, although nothing changed.** For example, a nightly run on an unchanged `main`. The gate is an alarm, not a verdict: a guarded check can fail once by chance. An example: if 1 of 11 results is wrong and nothing changed, the wrong one lands in the new run 1 time in 11, about 9 %.

1. Run the eval ten times by hand and look the check up in the table. For a 10/10 check, harmed means 6 of 10 or below.
2. Not harmed: add **two** files to `evals/baseline/` in one commit, the ten-run export and the red run's own `eval-result.json`, downloaded from the run's page on GitHub (Artifacts). The red run is the only evidence that the check can fail. A check that fails about 1 time in 30 still comes back 10 of 10 in ten new runs about 70 % of the time. With the ten-run file alone it would stay guarded (20 of 20), and the same false alarm could repeat. With both files it is 20 of 21, no longer guarded.
3. Green nightly runs are never added. They contain no wrong guarded check, so they would change no verdict.

The rules cover the "not harmed" case. I found no written rule for a check that comes out harmed with no code changed, which would mean the model's behaviour changed on Anthropic's side.

**Where this is written down.** The rules are in `CLAUDE.md`, spread over four sections:

| Section in `CLAUDE.md` | What it holds |
|---|---|
| Noise and comparing runs (Module 3.7) | the table; one eval with `--repeat 10` per experiment; how target checks and side effects are judged; that the boxes and totals never decide |
| CI (Module 3.8) | what the gate does; the `evals/baseline/` rules: files are added up, the two files after a false alarm, replacement on adoption, a new baseline after a label or email change |
| Open experiments | the planned experiments with their targets and baseline counts, and that each is judged against the current baseline |
| Conventions | the dump-and-diff after a change to the prompt, the schema or a generation parameter; `POLICY.md` before labels |

The roadmap's Module 5 lists which three experiments run first and in what order. The steps above, as one sequence, are only in this entry. The rules in `CLAUDE.md` are the ones that count.

**Recap in technical terms.** The baseline is a repeated-trials measurement of the unchanged pipeline: per-check pass rates over ten runs. The CI gate is a regression gate guarding only the checks with a perfect baseline record; flaky and consistently failing checks are reported but quarantined from the verdict. Experiments are A/B comparisons, ten runs against ten, judged per check with one-sided Fisher's exact test at α = 0.05, precomputed into a decision table. Adopting a change replaces the baseline atomically with the experiment's runs, so the gate ratchets: fixes become guarded. Changes to the golden set invalidate the baseline, and the gate refuses to judge until it is re-measured. A false alarm on an unchanged pipeline is resolved by re-measuring and adding the alarm run itself to the baseline.

**As of** 08.11.2026, Module 4. The baseline from 02.10.2026, as recorded at the end of Module 3. Table and experiment rule: `CLAUDE.md`, Noise and comparing runs. Gate and baseline rules: `CLAUDE.md`, CI, including the two-file rule added in Module 3.9. The order of steps in B is put together from those rules and the roadmap's Module 5; it isn't written as a sequence anywhere else. Not checked against the current files.

---

## Golden set

### 4. What is the difference between `POLICY.md` and `LABELLING.md`?

**In short.** `POLICY.md` says what the right answer is: the business rules, decided by the business owner. `LABELLING.md` says how to write that answer down in the golden set, so that two people who agree on the business still write the same thing. A change to `POLICY.md` can change a label; a change to `LABELLING.md` only changes how a label is written. The model sees neither file: the prompt and the schema are our implementation of the policy, and the eval measures how well they implement it.

**In detail**

**Why there is a policy at all.** Before Module 3.1, some business rules were written down in one place only: the system prompt. Email 19, a supplier offering us their services, was classified as advertising because a sentence in the prompt said so. If that sentence is the only place the rule exists, the prompt decides the correct answer, and rewording the prompt moves it. An eval built that way can't fail. So the project keeps three things apart:

| Artifact | What it is | Changed by |
|---|---|---|
| `POLICY.md` | What the business wants, in business terms. No prompts, schemas or models. | the business owner (Felix, playing the operations manager) |
| the golden labels | The correct answer for each golden email, derived from the policy. | labelling, following `LABELLING.md` |
| the prompt and the schema | An implementation of the policy. The thing under test. | engineering |

Rewording the third must never be able to move the second.

**The separating question.** When you are unsure about a label, ask: could two annotators who agree on everything the business wants still write different things?

- **Yes** → it's about how to write the value. The answer belongs in `LABELLING.md`.
- **No, they could disagree about the value itself** → it's about what the business wants. The answer belongs in `POLICY.md`.

Worked cases, all about deadlines:

| Email text (invented unless named) | `POLICY.md` decides | `LABELLING.md` decides |
|---|---|---|
| „Bitte bestätigen Sie die Stornierung bis Freitag." (like E-08) | It is a Frist: the customer wants an answer by a point in time (R-12). | Write `"bis Freitag"`: the time expression and the word that introduces it, without the full stop at the end of the sentence. |
| „Wir erwarten Ihre Rückmeldung innerhalb von drei Werktagen." | A Frist (R-12). | Write `"innerhalb von drei Werktagen"`. |
| „Sollte die Gutschrift nicht bis zum 30.04. vorliegen, …" (like E-12) | A Frist, and it stays one even after the date has passed (R-12). | Write `"bis zum 30.04."`: a date's dot is kept. |
| „Lieferung bis zum 15.04." (like E-10) | **Not** a Frist: it is a requested delivery date, even though it starts with „bis" (R-12). | Nothing to write: the label is `null`. A convention never turns something into a Frist. |
| „Wir überlegen, den Auftrag zu stornieren." | **Nothing yet.** Not a declared cancellation, and not a threat under R-11, because there is no condition („falls …"). A gap in the policy. | Can't help: no way of writing it down answers whether it is a cancellation. |
| „bis spätestens Freitag, 12 Uhr" | Clearly a Frist (R-12). | **Nothing yet**, if the convention doesn't say whether „12 Uhr" belongs in the label. Two annotators who agree it is a Frist could still write it differently. A gap in the conventions. |

The last two rows are the two kinds of gap, and they are fixed in different places:

| Gap | Where the fix goes | What else happens |
|---|---|---|
| in the policy (second-to-last row) | `POLICY.md`, decided by the business owner, with a new version | Stop labelling; recheck the cases the rule touches, then continue. |
| in the conventions (last row) | `LABELLING.md` | Recheck the cases already labelled, because one of them may have been written the other way. |
| neither: the answer was in `POLICY.md`, just hard to find | nowhere new | Write the label; optionally note in `notes` where the answer was. Example: „Bitte grüßen Sie Herrn Schmidt." is not an Anliegen, because `POLICY.md`'s Begriffe section says greetings aren't. |

**What a policy rule looks like.** Shortened and reworded from R-12; the real wording is in `docs/POLICY.md`:

```markdown
### R-12 — Fristen

Eine Frist ist ein Zeitpunkt, bis zu dem der Kunde von
uns eine Antwort oder eine Klärung verlangt. Sie wird im
Wortlaut der Nachricht festgehalten.

„Bitte bestätigen Sie uns die Stornierung bis Freitag"
enthält eine Frist.

Keine Frist ist ein Datum, das etwas anderes beschreibt,
auch wenn es mit „bis" eingeleitet wird:
- ein gewünschter Liefertermin („Lieferung bis zum 15.04."),
- ein von uns zugesagter Termin,
- ein Ereignis, das bereits stattgefunden hat.

Eine inzwischen abgelaufene Frist bleibt eine Frist.

**Begründung:** Eine Frist sagt, wann der Kunde eine
Reaktion erwartet, und bestimmt die Reihenfolge der
Bearbeitung. Liefertermine werden im Auftragsbestand
geprüft, nicht aus der Nachricht übernommen.

**Seit:** v1.0
```

In English: a Frist is a point in time by which the customer wants an answer or a clarification from us. A date that describes something else is not a Frist, even if it starts with „bis" ("by"): a requested delivery date, a date we promised, or something that already happened. A Frist that has since passed is still a Frist. The reason: it decides which email is worked on first. Delivery dates are checked in the order system, not taken from the email.

Every rule has the same parts:

- **an ID and a title** (R-12, Fristen). Labels and notes cite rules by ID, so an ID is never renumbered or reused; a new rule takes the next free number.
- **the rule**, with examples that match it and examples that don't. The examples come from the golden emails.
- **Begründung**: why the business wants it. Without the reason, nobody can tell later whether a new case falls under the rule.
- **Seit**: the version that introduced the rule.

**What else is in `POLICY.md`.** German content, an English filename and a short English note at the top for readers who don't speak German. The sections:

| Section | What it holds |
|---|---|
| version and date | The version that labels cite in `policyVersion`. |
| Zweck, Kontext | What the inbox is for and who works it: a Sachbearbeiter (a clerk) at a German mid-sized manufacturer. |
| Begriffe | Defined words, each with one meaning. In the first draft, *Anliegen* did three jobs; it became two terms: *Anliegen*, something the reply must address (the schema field `intents`), and *Gewünschte Maßnahme*, what the customer explicitly asks us to do (`requestedAction`). |
| Kategorien | The eight intent categories, each with its code value, such as Kaufanfrage → `purchase_inquiry`. |
| Regeln | R-01 to R-13 from Module 3, in five groups, in the order a clerk reads an email: Grundsätze, Einordnung, Gewünschte Maßnahme, Auftrags- und Kundenbezug, Dringlichkeit. Module 4 added R-14 to R-17, the rules for the order-system lookup, such as who may see which order. |
| Bekannte Lücken | Questions left open on purpose, each with its reason, and none with a test case. Examples: mail from our own suppliers has no category; an overdue delivery promise should raise urgency, but whether it is overdue is order-system data (Module 4); a message that only says thank you contains no Anliegen. |
| Änderungshistorie | Every change, with its date and whether it moved a label. Examples: v1.2 renamed Neuanfrage to Kaufanfrage (`new_inquiry` to `purchase_inquiry`), because "Neuanfrage" suggested a new customer; v1.3 made clear that a Rücksendeetikett (return label) is not a Dokumentenanforderung. |

The version rule: a clarification that moves no label is a minor version (v1.1); a change that moves a label is a major version (v2.0).

**What a labelling convention looks like.** Shortened and reworded from the `deadlineStated` convention; the real wording is in `docs/LABELLING.md`:

```markdown
### deadlineStated

Festgehalten wird nur die Zeitangabe mit dem Wort, das
sie einleitet („spätestens am 12.06.", „innerhalb von
drei Werktagen"), wörtlich und unübersetzt. Ein
Satzzeichen am Satzende gehört nicht dazu, der Punkt
eines Datums schon.

Ob etwas eine Frist ist, entscheidet R-12, nicht diese
Konvention.
```

In English: write only the time expression with the word that introduces it, word for word and untranslated. Punctuation at the end of the sentence is left out; a date's dot is kept. Whether something is a Frist is decided by R-12, not by this convention.

**What else is in `LABELLING.md`.** Also German, with an English note at the top:

| Part | What it holds |
|---|---|
| one convention per field | `intents`: a set of code values, at least one, no duplicates, no confidence. `requestedAction`: a short German summary with the verb at the end, such as „Liefertermin mitteilen", or `null` as R-06 and R-07 say. `orderNumbers`, `customerNumbers`: the number exactly as written, without the words around it, and no missing prefix added. `escalationSignals`: a set of code values. `deadlineStated`: as above. `urgency`: by hand, following R-13, never computed with `deriveUrgency`. |
| code values are names, not definitions | `purchase_inquiry` is a label for the category Kaufanfrage; what belongs in it is decided by `POLICY.md`. For example, an inquiry from an existing customer is a Kaufanfrage too. |
| `policyVersion` and `notes` | `policyVersion` is the `POLICY.md` version a case was last checked against, raised on a recheck even if no label moves. `notes` are optional: a rule ID and a short German reason, only where the annotator hesitated. |
| Zweifelsfälle | The three-way decision above: in the policy but hard to find, a gap in the conventions, or a gap in the policy. |
| examples | Invented or altered, never the golden emails, so that a convention never quietly answers a golden case. |

**Who reads which file.**

| Reader | `POLICY.md` | `LABELLING.md` |
|---|---|---|
| Felix, labelling | yes | yes |
| the second annotator (Gemini, Module 3.3) | yes | yes |
| the model inside `extractEmail` | never | never |

The model sees neither on purpose. `POLICY.md`'s examples come from the golden emails, so putting it in the prompt would hand the model the answers, and the eval would measure whether it can copy, not whether the prompt and schema capture the rules.

**How the split showed up in the numbers.** In Module 3.3, Felix and the second annotator agreed on 148 of 154 field labels (96.1 %). Each of the six differences was resolved against `POLICY.md`. Two of them were policy gaps and became new versions, v1.2 and v1.3. That is what the second annotator is for: a disagreement between two careful readers shows a rule that is unclear, before the model is ever measured against it.

**How the split shows up in the code.** The model is told to quote a deadline word for word, but it never sees the `LABELLING.md` convention on how much to quote. So the eval compares deadlines by containment rather than equality: equality would measure whether the model guessed a convention it was never given (entry 3, part 1). The same goes for `requestedAction`: the label's wording follows a convention the model doesn't know, so only presence is compared.

**Recap in technical terms.** `POLICY.md` is the business specification: versioned, with stable rule IDs, rationale, known gaps and a change log. It is the ground truth the labels are derived from. `LABELLING.md` is the annotation guidelines: recording conventions that make labels from different annotators comparable, plus the procedure for ambiguous cases. Keeping both out of the prompt separates the specification from the implementation under test and prevents label leakage. Inter-annotator agreement measured the specification's clarity before any model was measured against it.

**As of** 08.11.2026, Module 4. `POLICY.md` was v1.3 with R-01 to R-13 at the end of Module 3; by Module 4.5 it is v1.8 with R-14 to R-17 added (roadmap, 05.11.2026). The structure, R-12 and the conventions come from the Module 3.1 and 3.3 chats in which both files were written; the two excerpts are shortened and reworded, not checked against the current files.

---

## Extraction

### 5. How do we make sure the model's answer fits the schema?

**In short.** Twice, in two different places. First, on Anthropic's servers, while the model writes: at every step, Anthropic only lets it choose a next token that keeps the answer valid. That covers the parts of the schema that reach Anthropic: types, enum values, required fields and no extra fields. Second, on our machine, after the answer arrives: the AI SDK checks it against the full Zod schema, including the rules that never reach Anthropic, such as "at least one intent". If that check fails, the call throws an error. Nothing retries, and the model never sees the error. Neither check says whether the content is right; that is what the eval is for.

**In detail**

**From our code to Anthropic and back.** `extractEmail` calls `generateText` with `Output.object({ schema: emailExtractionSchema })`. One call goes through these stages:

| Stage | Where | Who | What happens |
|---|---|---|---|
| 1 | our machine, before the call | the AI SDK | Converts the Zod schema to JSON Schema and puts it in the request body under `output_config.format.schema`. |
| 2 | Anthropic's servers, while the model writes | Anthropic | Uses that JSON Schema to restrict which tokens the model may choose next. |
| 3 | Anthropic's servers, at the end | Anthropic | Sends the answer back with HTTP 200. No second check, no error for a bad answer. |
| 4 | our machine, after the reply | the AI SDK | Reads the text as JSON and checks it against the full Zod schema. Passes: `output` is typed data. Fails: the call throws. |
| 5 | the eval only | our assertions | Check the shape once more, then compare each field with its label (entries 1 and 3). |

**Stage 1: what survives the conversion.** JSON Schema can't express everything a Zod schema says, so part of the schema never reaches Anthropic as a rule. We checked this by dumping the request body (`docs/request-body-reference.json`), twice:

| In `src/schema.ts` | What Anthropic receives | Enforced by Anthropic? |
|---|---|---|
| a type: string, number, array, object | the type | yes |
| an enum, such as the eight intent codes | the list of allowed values | yes |
| every field required | `required` | yes |
| no fields beyond the schema's | `additionalProperties: false` | yes |
| `.nullable()` | "string or null" | yes |
| `.min(1)` on `intents` | only the text "min items: 1." added to the field's description | no: it becomes a request |
| the 0–1 range of `confidence` | only text in the description | no: a request |
| a `.refine()` rule | nothing | no |
| a `.describe()` sentence | the field's description | no: it is prompt text, not a rule |

The last row matters on its own: every `.describe()` sentence is prompt text that happens to be stored in the schema file. Changing one changes what the model is told.

**Stage 2: what "only what the schema allows" means.** A model writes one token at a time. At each step it computes a probability for every token it could write next and picks one. With a schema, Anthropic first removes every token that would make the answer break the schema, and the model picks among the rest. This is called constrained decoding. It isn't the model obeying a rule; the model simply can't choose a token that was removed. Examples:

| The answer so far | What the model may write next |
|---|---|
| `{"intents": [{"type": "` | only the start of one of the eight intent codes. `"reklamation"` is impossible. |
| a closing `}` before `deadlineStated` was written | impossible: the field is required |
| `"urgency":` as a new field | impossible: no extra fields |
| `"deadlineStated": ` | a string or `null` |
| `"requestedAction": "` | any text at all: the schema only says "string" |
| `"intents": [` followed by `]` | possible: "at least one" never reached Anthropic |
| `"confidence": ` | any number, including 1.3 |

So constrained decoding guarantees the shape, as far as the schema reached Anthropic, and says nothing about the content inside a string. `"orderNumbers": ["A-99999"]` has the perfect shape even when the email says A-61150.

It also explains the sentence "the schema can say unknown, so the model isn't forced to guess". Because of constrained decoding, the model has to write something into every required field. If `deadlineStated` could only be a string, an email without a deadline would still get one: the model would have to invent it. `.nullable()` gives it an allowed way to say "not in the email" (`null`, as `POLICY.md` R-01 asks), and the same goes for an empty list `[]` and the intent `other`.

Three ways an answer can still break the shape, even with constrained decoding:

- **A rule that never reached Anthropic:** `"intents": []` or `"confidence": 1.3`.
- **The answer is cut off** at `maxOutputTokens` (2,000 in our code). The JSON stops in the middle. The highest output we have measured was 484 tokens, so this is unlikely but possible.
- **The model refuses** instead of answering.

**Stage 4: the check on our side.** The AI SDK always does this check; we don't write it. It uses the full Zod schema, so it catches what Anthropic didn't enforce. Two errors are possible, and both are created by the AI SDK on our machine, not sent by Anthropic:

| What came back | Result |
|---|---|
| valid JSON that matches the Zod schema | `output` is the typed extraction |
| text that isn't valid JSON, or breaks the Zod schema | `NoObjectGeneratedError`. It carries the raw text (`.text`) and the reason (`.cause`), such as the Zod error naming the field. |
| no text at all, for example cut off before any was written | `NoOutputGeneratedError` |
| an HTTP error from Anthropic: 401 (bad key), 429 (too many requests), 529 (overloaded) | No answer to check. For errors that may pass, such as 429 or 529, the AI SDK first sends the same request again a few times; then it throws `APICallError` or `RetryError`. |

**Nothing retries a failed check.** The automatic retry in the last row only resends the same request after an HTTP error. It knows nothing about the schema. When the check in stage 4 fails, the call throws once and the error goes to whoever called `extractEmail`. The model is not called again and never sees the Zod error. A retry that shows the model its error would be a loop we write ourselves: catch the error, add its message to the conversation, call again. As far as the chats record, `extractEmail` has never had such a loop.

**Where the error ends up today:**

- **in the eval:** the adapter `providers/extract-email.ts` catches `NoObjectGeneratedError` and passes the raw text on, so every field check fails with `no valid extraction` (entry 3, part 2). An HTTP error becomes an ERROR, which isn't measured.
- **in the pipeline:** handling failures, with retries and a dead-letter queue, is Module 7 on the roadmap.

**How often it has happened.** In Module 3.5, a stand-in API (not the real model) returned HTTP 200 with `"intents": []`, and the AI SDK threw `NoObjectGeneratedError` as expected. The real model has produced no answer with the wrong shape in our runs: 20 of 20 at the end of Module 2, and 220 of 220 in the ten baseline runs.

**Stage 5: shape is not content.** All four stages check the shape. The eval checks the content, with three invented answers to an email about order A-61150:

| The model's answer | Shape | Content | Caught by |
|---|---|---|---|
| `orderNumbers: ["A-61150"]` | right | right | nothing to catch |
| `orderNumbers: ["A-99999"]` | right | wrong | only the eval's comparison with the label |
| `intents: []` | wrong | — | the AI SDK's check; in the eval, every field then counts as wrong |

**Keeping the sent schema the one we mean.** Two habits from Module 3, both recorded in `CLAUDE.md`:

- **`ai`, `@ai-sdk/anthropic` and `zod` are pinned to exact versions.** Together they produce the JSON Schema that is sent. A version bump could change it under an unchanged `schema.ts`.
- **After any change to the system prompt, `schema.ts` or a generation parameter, the request body is dumped again and diffed:**

```bash
DUMP_REQUEST_BODY=docs/request-body-reference.json npm run dump
git diff docs/request-body-reference.json
```

  The new reference is committed with the change that moved it. An unexpected diff means stop.

**What was corrected along the way.** Several explanations of this were wrong at first, mine and yours. All were settled the same way: by looking at what was actually sent, or at the current docs.

| Claim | What is true | How it was found |
|---|---|---|
| The AI SDK wraps the schema in a hidden tool and forces the model to call it. (Claude, Module 2) | The schema goes in `output_config.format.schema`. No tool, no forced tool call. | The response had no tool call; the dumped request body showed `output_config`. |
| When validation fails, the SDK retries and shows the model the error. (Claude, first `extract.ts`, Module 2) | No retry; the call throws once. | The AI SDK docs, checked again for AI SDK 7. |
| Anthropic checks the answer and sends an error back. (Felix's question, Module 3.6) | Anthropic sends HTTP 200 for every answer it writes. Both errors come from the AI SDK. | Module 3.5: the stand-in API returned 200 with `"intents": []`, and the AI SDK threw. |
| `.min(1)` and the 0–1 range reach Anthropic. (an early assumption) | They become text in the description. | The dumped request body, checked for both. |
| The project uses AI SDK 6. (`CLAUDE.md`, Module 2) | AI SDK 7. | Corrected in `CLAUDE.md` at the start of Module 3. |

The lesson recorded in the course outline: claims about what a library sends get checked on the wire, whoever makes them.

**Recap in technical terms.** Structured outputs on Anthropic use constrained decoding: the Zod schema is converted to JSON Schema and sent as `output_config.format.schema`, and sampling is restricted to tokens that keep the output valid. Only type, enum, required and `additionalProperties` are enforced server-side; length and range constraints are demoted to description text, and refinements are dropped. The AI SDK then validates the response client-side against the full Zod schema and throws `NoObjectGeneratedError` or `NoOutputGeneratedError`. There is no repair or retry on validation failure; `maxRetries` covers transport errors only. Representable absence (nullable fields, empty arrays, a residual category) keeps constrained decoding from forcing fabricated values. Validation checks structure; semantic correctness is measured by the eval against golden labels.

**As of** 08.11.2026, Module 4. Model `claude-sonnet-5`, AI SDK 7. What is enforced: `CLAUDE.md` (Stack facts), from the dumped request body. Errors and retry: the AI SDK docs, checked on 29.09.2026. The corrections: the Module 2, 3.5 and 3.6 chats. Not checked against the current code: whether `extractEmail` still has no retry loop.

---

## How entries get here

Entries start as questions asked in a chat or in Claude Code. Before an answer goes in, its facts are checked against the repo and `CLAUDE.md`. A new question goes under its topic; a question that is already here is merged into the existing entry rather than added twice. When the code or a number changes, the affected entry is rewritten and gets a new **As of** line.
