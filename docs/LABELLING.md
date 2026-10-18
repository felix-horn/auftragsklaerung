# Auftragsklärung — Leitfaden für das Labelling

**Bezieht sich auf:** `docs/POLICY.md` v1.4
**Stand:** 18.10.2026

> **Note for English-speaking readers.** This is the annotation guide for the
> golden set used to evaluate the Auftragsklärung system. `docs/POLICY.md`
> states what the business wants; this guide states how an annotator records
> those decisions as labels, so that two annotators applying the same policy
> produce the same labels. It contains no business rules and no answers for
> individual test cases.

---

## Zweck

POLICY.md legt fest, wie eine Nachricht fachlich zu bewerten ist. Dieser
Leitfaden legt fest, wie das Ergebnis dieser Bewertung als Label in das
Golden Set eingetragen wird — so, dass zwei Annotatoren, die dieselbe
Nachricht nach POLICY.md bewerten, auch dasselbe eintragen.

Wohin eine Frage gehört, hängt davon ab, was ihre Antwort ändert:

| Die Antwort ändert … | Ort |
|---|---|
| … was das Unternehmen will | `docs/POLICY.md`, mit Versionssprung |
| … nur, wie eine bereits getroffene Bewertung eingetragen wird | dieser Leitfaden |
| … Prompt, Schema oder Code | `CLAUDE.md` |

Der Leitfaden enthält keine fachlichen Regeln und keine Lösung für einen
einzelnen Testfall. Er wird auch dem zweiten Annotator vorgelegt; eine
Lösung darin würde dessen Urteil vorwegnehmen.

Beim Labeln gilt daher: Welcher Wert richtig ist, steht in POLICY.md — die
Spalte „Maßgeblich“ unter „Zuordnung“ zeigt für jedes Feld, wo. Dieser
Leitfaden regelt nur, wie der Wert eingetragen wird.

---

## Zuordnung

Das Golden Set verwendet die Feldnamen und Codewerte des Systems, damit
Label und Systemausgabe direkt verglichen werden können.

Codewerte sind Namen, keine Definitionen. Was eine Kategorie umfasst, steht
allein in POLICY.md, gleich was das englische Wort nahelegt. `spam` umfasst
auch eine höflich formulierte Verkaufsansprache (R-03). `complaint` umfasst
keine Beanstandung einer Rechnung (Kategorie Reklamation). `other` ist keine
Ausweichkategorie für Zweifelsfälle (Kategorie Sonstiges).

### Begriffe und Felder

R-01 gilt für jedes Feld.

| Begriff in POLICY.md | Feld | Maßgeblich |
|---|---|---|
| Kategorien der Anliegen | `intents` | Begriffe, Kategorien, R-03, R-04, R-05, R-11 |
| Gewünschte Maßnahme | `requestedAction` | Begriffe, R-02, R-06, R-07 |
| Auftragsnummern | `orderNumbers` | R-02, R-08, R-09 |
| Kundennummern | `customerNumbers` | R-02, R-09 |
| Eskalationsmerkmale | `escalationSignals` | R-10, R-11 |
| Frist | `deadlineStated` | R-02, R-12 |
| Dringlichkeit | `urgency` | R-13 |

`urgency` liefert nicht das Modell; das System berechnet sie im Code aus
Eskalationsmerkmalen und Frist. Im Golden Set wird sie trotzdem eigenständig
nach R-13 gelabelt, damit sich prüfen lässt, ob diese Berechnung R-13
umsetzt.

### Kategorien

| POLICY.md | Codewert |
|---|---|
| Auftragsstatus | `order_status` |
| Reklamation | `complaint` |
| Kaufanfrage | `purchase_inquiry` |
| Rechnungsfrage | `invoice_question` |
| Stornierung | `cancellation` |
| Dokumentenanforderung | `document_request` |
| Werbung | `spam` |
| Sonstiges | `other` |

### Eskalationsmerkmale

| POLICY.md | Codewert |
|---|---|
| Wiederholte Kontaktaufnahme | `repeat_contact` |
| Angedrohte Stornierung | `threat_to_cancel` |
| Produktionsstillstand | `production_halt` |
| Angekündigte rechtliche Schritte | `legal_threat` |

### Dringlichkeit

| POLICY.md | Codewert |
|---|---|
| Hoch | `high` |
| Mittel | `medium` |
| Niedrig | `low` |

---

## Reihenfolge

Gelabelt wird in der Reihenfolge der Abschnitte von POLICY.md:

1. Einordnung → `intents`
2. Gewünschte Maßnahme → `requestedAction`
3. Auftrags- und Kundenbezug → `orderNumbers`, `customerNumbers`
4. Dringlichkeit → `escalationSignals`, `deadlineStated`, zuletzt `urgency`

Spätere Schritte hängen von früheren ab. Ob eine gewünschte Maßnahme
festgehalten wird, hängt von der Kategorie ab (R-07). Die Dringlichkeit
ergibt sich ausschließlich aus Eskalationsmerkmalen und Frist (R-13). Sie
wird deshalb zuletzt bestimmt, und nur aus diesen beiden Einträgen — nicht
aus dem Gesamteindruck der Nachricht.

---

## Konventionen je Feld

Welcher Wert gilt, entscheidet POLICY.md. Dieser Abschnitt regelt nur, wie
er eingetragen wird. Alle Beispiele sind erfunden und stammen nicht aus dem
Golden Set.

### `intents`

Die Codewerte der Kategorien aller Anliegen, als Menge: Reihenfolge ohne
Bedeutung, jeder Codewert höchstens einmal, mindestens einer. Enthält eine
Nachricht zwei Anliegen derselben Kategorie, steht deren Codewert trotzdem
nur einmal.

Keine Konfidenzwerte: sie sind die Selbsteinschätzung des Modells, und einen
richtigen Wert dafür gibt es nicht.

Beispiel: Eine Nachricht fragt nach dem Stand eines Auftrags und bittet
außerdem um ein Datenblatt → `["order_status", "document_request"]`.

### `requestedAction`

Ob eine gewünschte Maßnahme festgehalten wird, entscheiden R-06 und R-07.
Wird sie festgehalten, dann knapp, auf Deutsch (R-02) und in eigenen Worten,
mit dem Verb im Infinitiv am Ende: „Liefertermin mitteilen“, „Datenblatt
zusenden“. Festgehalten wird nur, was der Kunde verlangt (R-01). Mehrere
Maßnahmen stehen in einem Eintrag, durch Semikolon getrennt. Sonst `null`.

Verglichen wird vorerst nur, ob ein Eintrag vorhanden ist oder `null`, nicht
sein Wortlaut. Der Eintrag zwingt dazu, die Stelle zu finden, an der der
Kunde etwas verlangt.

### `orderNumbers`, `customerNumbers`

Welche Nummer in welches Feld gehört, entscheiden R-08 und R-09. Eingetragen
wird die Nummer selbst, genau wie geschrieben, ohne umgebende Wörter:
`"A-70315"`, nicht `"Auftrag A-70315"`. Ein fehlendes Präfix wird nicht
ergänzt (R-09, Stufe 2): „Kundennr. 55120“ → `"55120"`.

Reihenfolge ohne Bedeutung; jede Nummer höchstens einmal, auch wenn sie in
der Nachricht mehrfach vorkommt. Keine Nummer → `[]`.

### `escalationSignals`

Welche Merkmale vorliegen, entscheiden R-10 und R-11. Eingetragen werden
ihre Codewerte, als Menge: Reihenfolge ohne Bedeutung, jeder Codewert
höchstens einmal. Kein Merkmal → `[]`.

### `deadlineStated`

Ob eine Frist vorliegt, entscheidet R-12. Eingetragen wird nur die
Zeitangabe samt dem Wort, das sie einleitet (etwa „bis“, „spätestens“,
„innerhalb“), ohne Verb und ohne den Rest des Satzes. Der Wortlaut bleibt
unverändert, einschließlich Groß- und Kleinschreibung, und wird nicht
übersetzt (R-02). Ein Satzzeichen am Satzende gehört nicht dazu, der Punkt
eines Datums wie „12.06.“ schon.

- „Wir erwarten Ihre Rückmeldung spätestens am 12.06., da unsere Planung
  davon abhängt.“ → `"spätestens am 12.06."`
- „Bitte klären Sie das innerhalb von drei Werktagen.“ →
  `"innerhalb von drei Werktagen"`
- „Please confirm by end of next week.“ → `"by end of next week"`

Die Konvention regelt nur, wie eine Frist eingetragen wird, nie, ob etwas
eine ist. „Sie hatten uns die Lieferung bis Ende Mai zugesagt.“ enthält „bis“
und eine Zeitangabe, ist nach R-12 aber keine Frist → `null`.

### `urgency`

Nach R-13, von Hand, und nur aus den bereits eingetragenen Werten von
`escalationSignals` und `deadlineStated`. Nicht mit dem Code des Systems
berechnen: sonst würde die Prüfung dieser Berechnung den Code mit sich
selbst vergleichen.

Beispiel: `escalationSignals: ["repeat_contact"]` und
`deadlineStated: "spätestens am 12.06."` → `"medium"`. Beide gehören zur
mittleren Stufe, und Merkmale addieren sich nicht (R-13).

### `policyVersion`

Die Version von POLICY.md, gegen die der Fall zuletzt geprüft wurde, etwa
`"v1.2"`. Wird ein Fall nach einer Änderung von POLICY.md erneut geprüft,
wird die Version angehoben, auch wenn sich kein Label ändert.

### `notes`

Optional. Je Feld ein kurzer Regelverweis, wo das Feld nicht offensichtlich
war (siehe Zweifelsfälle), etwa `deadlineStated: "R-12: …"`. Die meisten
Fälle brauchen keinen.

---

## Zweifelsfälle

Wer bei einem Feld länger als etwa 30 Sekunden zögert, klärt vor dem
Weiterlabeln, wo die Antwort steht. Davon hängt ab, was zu tun ist.

**Die Antwort steht in POLICY.md, sie war nur schwer zu finden.** Der Wert
wird eingetragen; optional wird unter `notes` vermerkt, wo die Antwort
steht. Sonst ist nichts zu tun: auch der zweite Annotator hat POLICY.md.

> Beispiel: „Bitte grüßen Sie Herrn Schmidt.“ klingt wie eine Bitte. Dass es
> kein Anliegen ist, steht nicht in den Regeln, sondern unter Begriffe
> (Grußformeln).

**Die Antwort steht nirgends und betrifft nur die Schreibweise.** Die
Antwort wird als Konvention unter „Konventionen je Feld“ eingetragen, damit
auch der zweite Annotator sie kennt — `notes` bekommt er nicht zu sehen.
Die Konvention gilt für alle Fälle; bereits gelabelte Fälle werden daraufhin
nachgesehen.

> Beispiel: „bis spätestens Freitag, 12 Uhr“ ist nach R-12 eine Frist. Offen
> ist nur, ob „12 Uhr“ zum Eintrag gehört.

**Die Antwort steht nirgends und betrifft den Wert selbst**, oder zwei
Regeln widersprechen sich. Das ist eine Lücke in POLICY.md. Das Labeln
stoppt. POLICY.md wird ergänzt und die Version erhöht; die bereits
gelabelten Fälle, die die betroffene Regel berühren, werden erneut geprüft.
Erst dann geht es weiter.

> Beispiel: „Wir überlegen, den Auftrag A-12345 zu stornieren.“ ist keine
> erklärte Stornierung und nach R-11 auch keine Drohung, weil die Bedingung
> fehlt.

Unterscheidung der letzten beiden Fälle: Würden zwei Annotatoren, die sich
fachlich einig sind, trotzdem Verschiedenes eintragen? Dann betrifft die
Frage die Schreibweise. Könnten sie fachlich verschiedener Meinung sein?
Dann ist es eine Lücke in POLICY.md.

Konventionen sind allgemein formuliert und nennen keinen Testfall.
