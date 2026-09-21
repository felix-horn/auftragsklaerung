# Auftragsklärung — Fachliche Regeln

**Version:** v1.0
**Stand:** 21.09.2026
**Status:** Entwurf — Bestätigung von R-13 ausstehend

## Zweck dieses Dokuments

Dieses Dokument legt fest, wie eingehende Nachrichten in der Auftragsklärung
fachlich zu bewerten sind: welcher Kategorie eine Nachricht angehört, was aus
ihr festgehalten wird und wie dringend sie ist. Es beschreibt keine technische
Umsetzung. Die Regeln gelten unabhängig davon, ob die Bewertung durch einen
Mitarbeiter oder durch ein System erfolgt. Wird die Bewertung ganz oder
teilweise automatisiert, werden deren Ergebnisse an diesen Regeln gemessen.

Jede Regel trägt eine feste Kennung (R-01, R-02, …). Kennungen werden nie neu
vergeben, auch nicht, wenn eine Regel entfällt. Klarstellungen ohne Auswirkung
auf bestehende Bewertungen erhöhen die Nebenversion (v1.1), inhaltliche
Änderungen die Hauptversion (v2.0). Jede Änderung wird in der
Änderungshistorie festgehalten.

Die Regeln sind in der Reihenfolge angeordnet, in der eine Nachricht gelesen
wird: Grundsätze, Einordnung, gewünschte Maßnahme, Auftrags- und Kundenbezug,
Dringlichkeit.

> **Note for English-speaking readers.** This document is the specification
> for an LLM-based email triage system for a German industrial parts supplier.
> It is deliberately written in business terms, without reference to prompts,
> schemas or models. The system prompt and the output schema are one
> implementation of these rules and are the thing under test; the evaluation
> labels (golden set) are derived from this document, never from the prompt.
> Rewording the prompt therefore cannot change a label. Each rule has a stable
> ID so that every golden label can cite the rule — and the version of this
> document — that decided it.

---

## Kontext

Wir sind ein deutscher Zulieferer für Industrieteile und beliefern
ausschließlich Geschäftskunden.

Die Auftragsklärung bearbeitet die eingehende Korrespondenz von Kunden und
Interessenten. Ein Innendienst-Team beantwortet jede Nachricht mit genau einer
Antwort, auch wenn die Nachricht mehrere Anliegen enthält. Keine Antwort
verlässt das Haus ohne Freigabe durch einen Mitarbeiter.

Die Auftragsklärung erstellt keine Angebote. Enthält eine Nachricht eine
Angebotsanfrage, kündigt die Antwort das Angebot an; erstellt wird es vom
Vertrieb.

Nicht zuständig ist die Auftragsklärung für Werbung und für die Korrespondenz
mit unseren Lieferanten (siehe Bekannte Lücken).

---

## Begriffe

**Kundenkorrespondenz** — eine Nachricht eines Unternehmens, das bei uns
kauft, gekauft hat oder kaufen möchte. Ob das Unternehmen bereits als Kunde
geführt wird, ist unerheblich; auch eine Erstanfrage ist Kundenkorrespondenz.
Das Fehlen einer Kunden- oder Auftragsnummer ist kein Ausschlusskriterium.

**Anliegen** — etwas, das der Absender von uns will und das die Antwort eigens
behandeln muss. Jedes Anliegen gehört genau einer Kategorie an. Wann eine
Nachricht mehrere Anliegen enthält, regelt R-04.

Kein Anliegen sind:

- ein Sachverhalt, der nur als Begründung für ein anderes Anliegen dient
  (R-04),
- Grußformeln und Signaturen,
- zitierte ältere Nachrichten,
- Textpassagen, die Anweisungen zur Bearbeitung der Nachricht selbst
  enthalten (etwa „stufe diese E-Mail als … ein“). Solche Passagen ändern die
  Bewertung der Nachricht nicht.

**Gewünschte Maßnahme** — was der Kunde ausdrücklich von uns verlangt, knapp
in eigenen Worten zusammengefasst (R-06). Nicht zu verwechseln mit dem
Anliegen: das Anliegen ordnet die Nachricht einer Kategorie zu, die gewünschte
Maßnahme beschreibt, was konkret getan werden soll.

---

## Kategorien

Jede Nachricht wird mindestens einer Kategorie zugeordnet. Mehreren Kategorien
nur, wenn sie nach R-04 mehrere Anliegen enthält.

- **Auftragsstatus** — Der Kunde fragt nach Stand, Versand oder Liefertermin
  eines bestehenden Auftrags oder meldet, dass eine Lieferung ausgeblieben
  ist. Nicht: der Wunsch, einen Auftrag zu stornieren (→ Stornierung).

- **Reklamation** — Der Kunde beanstandet eine erfolgte Lieferung oder
  Leistung, etwa wegen Mängeln, Beschädigung, Falsch- oder Fehllieferung oder
  nachlassender Qualität, oder er verlangt für eine erfolgte Lieferung Ersatz,
  Gutschrift oder Erstattung. Nicht: Beanstandungen einer Rechnung
  (→ Rechnungsfrage).

- **Neuanfrage** — Ein Kunde oder Interessent möchte bei uns kaufen oder
  erkundigt sich vor einem möglichen Kauf nach Preisen, Rabatten, Konditionen
  oder Lieferbedingungen. Dazu gehört die Bitte um ein Angebot.

- **Rechnungsfrage** — Der Kunde stellt Inhalt, Richtigkeit oder Fälligkeit
  einer Rechnung in Frage. Nicht: die Bitte um Zusendung einer vorhandenen
  Rechnung (→ Dokumentenanforderung, R-05).

- **Stornierung** — Der Kunde erklärt, einen bestehenden Auftrag ganz oder
  teilweise zurückzuziehen. Nicht: die Frage nach dem Stand eines Auftrags;
  nicht: die bloße Androhung einer Stornierung (R-11).

- **Dokumentenanforderung** — Der Kunde bittet um Zusendung oder erneute
  Zusendung eines vorhandenen Dokuments, etwa einer Auftragsbestätigung, eines
  Katalogs, eines Zertifikats, eines Lieferscheins oder einer Rechnungskopie.

- **Werbung** — Nachrichten, mit denen uns jemand etwas verkaufen will (R-03),
  sowie offensichtlich unseriöse oder betrügerische Massennachrichten.

- **Sonstiges** — ein echtes Anliegen eines Kunden, das in keine andere
  Kategorie fällt, etwa die Änderung hinterlegter Stammdaten wie der
  Lieferadresse. Sonstiges ist keine Ausweichkategorie für Zweifelsfälle: ist
  unklar, welche von mehreren Kategorien zutrifft, wird die zutreffendste
  gewählt, nicht Sonstiges. Sonstiges kann neben einer anderen Kategorie
  stehen, wenn die Nachricht zusätzlich ein Anliegen enthält, das in keine
  andere Kategorie passt.

---

## Grundsätze

### R-01 — Nur schriftlich Genanntes wird festgehalten

Festgehalten wird ausschließlich, was in der Nachricht steht. Ein Sachverhalt,
der sich aus Erfahrung oder Branchenkenntnis ergibt, aber nicht geschrieben
wurde, wird nicht festgehalten.

Zusammenfassen ist erlaubt. „Können Sie mir den Status nennen?“ darf als
„Versandstatus mitteilen“ festgehalten werden — der Inhalt steht in der
Nachricht, nur kürzer.

Auswählen ist erlaubt. Nennt ein Kunde zwei Auftragsnummern und bezieht sich
erkennbar nur auf eine davon, wird diese festgehalten (R-08). Die Entscheidung
ergibt sich aus dem Text.

Ergänzen ist nicht erlaubt. Schildert ein Kunde ein Qualitätsproblem, ohne
eine Ersatzlieferung zu verlangen, wird keine Ersatzlieferung festgehalten —
auch dann nicht, wenn sie naheliegt (R-06).

**Begründung:** Die Freigabe durch einen Mitarbeiter setzt voraus, dass er
unterscheiden kann, was der Kunde geschrieben hat und was ergänzt wurde. Eine
Ergänzung, die wie eine Aussage des Kunden festgehalten wird, ist später nicht
mehr als Ergänzung erkennbar.

**Seit:** v1.0

### R-02 — Freitext ist deutsch, Zitate sind wörtlich

Was in eigenen Worten festgehalten wird, insbesondere die gewünschte
Maßnahme, wird auf Deutsch festgehalten, unabhängig davon, in welcher Sprache
die Nachricht verfasst ist. Schreibt ein Kunde „Please send us a return
label“, wird „Rücksendeetikett zusenden“ festgehalten.

Was wörtlich übernommen wird, insbesondere Fristen und Nummern, bleibt im
Wortlaut der Nachricht, auch wenn dieser nicht deutsch ist. Eine Frist „by
next Friday“ wird als „by next Friday“ festgehalten, nicht übersetzt.

**Begründung:** Die Auftragsklärung wird von deutschsprachigen Mitarbeitern
bearbeitet; Zusammenfassungen müssen ohne Übersetzung lesbar sein. Wörtlich
Übernommenes dient dagegen als Beleg dafür, was der Kunde geschrieben hat.
Eine Übersetzung könnte seine Bedeutung verschieben.

**Seit:** v1.0

---

## Einordnung

### R-03 — Verkaufsansprache an uns ist Werbung

Bietet ein Unternehmen uns seine Produkte oder Leistungen an, ist die
Nachricht Werbung. Das gilt unabhängig davon, wie professionell sie verfasst
ist und ob ein Katalog, ein Muster oder ein Gesprächstermin angeboten wird.

Maßgeblich ist die Richtung des Angebots. Wer uns etwas verkaufen will,
schreibt Werbung. Wer von uns etwas kaufen will oder bereits gekauft hat,
schreibt Kundenkorrespondenz — auch beim ersten Kontakt, auch ohne Kunden-
oder Auftragsnummer und auch ohne dass wir den Absender kennen.

Der Hinweis, man beliefere bereits andere Unternehmen unserer Branche, ändert
daran nichts. Entscheidend ist die Richtung des Angebots, nicht wie vertraut
der Absender wirkt.

**Begründung:** Die Auftragsklärung hält Kundenanliegen in Bewegung.
Verkaufsangebote gehören zum Einkauf und haben eine andere Dringlichkeit. Die
Erstanfrage eines neuen Interessenten ist dagegen die wertvollste Nachricht,
die wir bekommen — sie darf nicht daran scheitern, dass der Absender noch
nicht in unseren Stammdaten steht.

**Seit:** v1.0

### R-04 — Mehrere Anliegen nur bei unabhängigen Punkten

Jede Nachricht hat mindestens ein Anliegen. Mehrere Anliegen liegen vor, wenn
die Antwort mehrere voneinander unabhängige Punkte behandeln muss.

Dient ein Sachverhalt lediglich als Begründung für ein anderes Anliegen,
liegt nur ein Anliegen vor.

Im Zweifel: Würde eine Antwort, die nur eines der beiden Anliegen behandelt,
den Kunden vollständig zufriedenstellen? Dann ist es ein Anliegen.

Beispiele:

- „Die gelieferten Dichtungen zu Bestellung A-47190 waren leider beschädigt,
  das müssen wir reklamieren. Außerdem bräuchten wir ein Angebot für 200 Stück
  Sechskantschrauben M12.“ — Zwei Anliegen: Reklamation und Neuanfrage. Die
  Punkte hängen nicht zusammen; eine Antwort nur zur Reklamation ließe die
  Anfrage offen.

- „We … received the wrong item. Wir möchten die Bestellung daher komplett
  stornieren und bitten um ein Rücksendeetikett.“ — Ein Anliegen:
  Stornierung. Die Falschlieferung ist der Grund der Stornierung („daher“),
  kein eigenes Anliegen.

- „Ich habe die Rechnung 2024-8820 erhalten, aber die Ware zu Bestellung
  A-59401 ist noch nicht da. Muss ich trotzdem innerhalb der Zahlungsfrist
  zahlen?“ — Ein Anliegen: Rechnungsfrage. Die ausstehende Lieferung ist der
  Anlass der Frage, keine eigene Bitte.

**Begründung:** Jede Nachricht erhält genau eine Antwort (siehe Kontext).
Mehrere Anliegen bedeuten, dass diese Antwort mehrere Punkte eigens abdecken
muss. Wird der Anlass eines Anliegens als eigenes Anliegen gezählt, behandelt
die Antwort einen Nebensatz wie einen Auftrag.

**Seit:** v1.0

### R-05 — Dokumentenanforderung geht vor Rechnungsfrage

Bittet der Kunde darum, dass wir ihm ein vorhandenes Dokument zusenden oder
erneut zusenden, ist das eine Dokumentenanforderung — gleich, worauf sich das
Dokument bezieht. Die Bitte um eine Rechnungskopie ist eine
Dokumentenanforderung, keine Rechnungsfrage.

Eine Rechnungsfrage liegt nur vor, wenn der Kunde Inhalt, Richtigkeit oder
Fälligkeit einer Rechnung in Frage stellt.

Verlangt der Kunde eine korrigierte Rechnung, ist das eine Rechnungsfrage:
das Dokument existiert noch nicht, und seiner Erstellung geht eine Prüfung
voraus.

Beispiele:

- „Zu Auftrag A-51123 fehlt noch die Auftragsbestätigung. Können Sie diese
  nachsenden?“ — Dokumentenanforderung.
- „Bitte senden Sie uns die Rechnung 2024-9981 noch einmal zu.“ —
  Dokumentenanforderung.
- „Der Betrag stimmt nicht mit der Auftragsbestätigung überein.“ —
  Rechnungsfrage.
- „Der Betrag stimmt nicht, bitte schicken Sie uns eine korrigierte
  Rechnung.“ — Rechnungsfrage.

**Begründung:** Das Zusenden eines vorhandenen Dokuments ist ein schneller
Vorgang ohne Prüfung. Eine Rechnungsfrage verlangt eine inhaltliche Prüfung.
Die Kategorie richtet sich danach, welcher der beiden Vorgänge ausgelöst wird,
nicht danach, welches Wort in der Nachricht vorkommt.

**Seit:** v1.0

---

## Gewünschte Maßnahme

### R-06 — Die gewünschte Maßnahme wird nur festgehalten, wenn der Kunde sie nennt

Die gewünschte Maßnahme wird festgehalten, wenn die Nachricht sie ausspricht:
als Bitte, als Frage oder als Aussage darüber, was der Kunde erwartet. Die im
Geschäftsverkehr übliche Höflichkeitsform zählt uneingeschränkt.

Beispiele:

- „Können Sie mir den Status nennen?“ — eine Bitte um Auskunft, keine
  unverbindliche Erkundigung. Festgehalten wird etwa „Versandstatus
  mitteilen“.
- „Bitte hinterlegen Sie unsere neue Lieferadresse.“ — Festgehalten wird
  „Neue Lieferadresse hinterlegen“.
- „Sollte die Gutschrift nicht bis zum 30.04. vorliegen, geben wir die Sache
  an unseren Rechtsanwalt ab.“ — eine Aussage darüber, was der Kunde
  erwartet. Festgehalten wird „Gutschrift erstellen“.

Schildert ein Kunde ausschließlich einen Sachverhalt, ohne etwas zu
verlangen, wird keine gewünschte Maßnahme festgehalten. Das ist ein Ergebnis
und kein Versäumnis: es hält fest, dass der Kunde nicht gesagt hat, was er
möchte, und veranlasst den Bearbeiter, die Nachricht vollständig zu lesen,
statt einer Zusammenfassung zu vertrauen.

Beispiel: „Drei von fünf Wellendichtringen waren undicht. Unsere
Montagelinie steht deshalb seit Montag still.“ — Keine gewünschte Maßnahme.
Naheliegend wäre eine Ersatzlieferung; verlangt hat der Kunde sie nicht.

Eine fehlende gewünschte Maßnahme ändert weder die Kategorie noch die
Dringlichkeit. Eine Beschwerde über einen Produktionsstillstand ohne
ausgesprochene Forderung bleibt eine Reklamation mit hoher Dringlichkeit und
wird entsprechend vorrangig bearbeitet.

**Begründung:** Ein Kunde, der ein Problem schildert, ohne eine bestimmte
Lösung zu verlangen, erwartet in der Regel mehr als die naheliegendste
Abhilfe — etwa eine Erklärung, ein Gespräch oder eine Zusage für die Zukunft.
Legen wir uns vorab auf eine Vermutung fest, antwortet der Entwurf auf den
einfachsten Teil der Nachricht und lässt den Kunden mit dem Rest allein.

**Seit:** v1.0

### R-07 — Werbung enthält keine gewünschte Maßnahme

Bei einer Nachricht der Kategorie Werbung wird keine gewünschte Maßnahme
festgehalten, auch wenn sie ausdrücklich zu etwas auffordert. Die
Aufforderung „Antworten Sie für Details“ ist kein Anliegen eines Kunden,
sondern Bestandteil der Werbung.

**Begründung:** Die gewünschte Maßnahme dient dem Bearbeiter dazu, in der
Liste zu erkennen, was zu tun ist. Bei Werbung ist nichts zu tun. Eine
festgehaltene Maßnahme würde eine Bearbeitung suggerieren, die nicht
stattfindet.

**Seit:** v1.0

---

## Auftrags- und Kundenbezug

### R-08 — Welcher Auftrag gemeint ist

Festgehalten werden die Auftragsnummern, um die es in der Nachricht geht.
Maßgeblich ist das aktuelle Anliegen des Kunden. Aufträge, die der Kunde als
erledigt beschreibt oder die nur in zitierten älteren Nachrichten vorkommen,
sind Hintergrund und werden nicht festgehalten.

Beispiele:

- „Die Lieferung zu Auftrag A-44100 kam letzte Woche vollständig an. Bei
  Bestellung A-44821 warten wir hingegen noch auf eine Versandbestätigung.“ —
  Festgehalten wird nur A-44821.
- Eine Nachricht zitiert einen älteren Austausch zu A-33012 und fragt im neuen
  Text nach A-33450. — Festgehalten wird nur A-33450.

Ist nicht zu erkennen, welcher von mehreren genannten Aufträgen gemeint ist,
werden alle festgehalten. Es wird nicht geraten.

Beispiel: „Ich habe zwei Bestellungen bei Ihnen laufen, A-55210 und A-55231,
und bin mir nicht mehr sicher, zu welcher die fehlende Dichtung gehört.“ —
Festgehalten werden beide.

**Begründung:** Eine falsche Auftragsnummer führt zur Prüfung des falschen
Vorgangs. Eine zusätzliche Nummer kostet den Bearbeiter einen Blick, eine
fehlende oder falsch gewählte Nummer eine Rückfrage beim Kunden.

**Seit:** v1.0

### R-09 — Auftrags- und Kundennummern

Auftragsnummern beginnen mit „A-“, Kundennummern mit „K-“, jeweils gefolgt
von fünf Ziffern (A-52140, K-40928).

Ob eine Nummer als Auftrags- oder als Kundennummer festgehalten wird,
entscheidet sich in dieser Reihenfolge. Die erste zutreffende Stufe gilt.

1. Trägt die Nummer eines dieser Präfixe, entscheidet das Präfix —
   unabhängig davon, wie der Kunde die Nummer bezeichnet.
2. Trägt sie kein Präfix, bezeichnet der Kunde sie aber ausdrücklich als
   Auftrag, Bestellung, Auftrags- oder Bestellnummer beziehungsweise als
   Kundennummer, entscheidet diese Bezeichnung. Die Nummer wird so
   festgehalten, wie sie geschrieben steht.
3. Trägt sie weder ein Präfix noch eine solche Bezeichnung, wird sie weder
   als Auftrags- noch als Kundennummer festgehalten.

Beispiele:

- „unsere Kundennummer K-40928“ — Kundennummer K-40928 (Stufe 1; Präfix und
  Bezeichnung stimmen überein).
- „unsere Bestellnummer K-40928“ — Kundennummer K-40928 (Stufe 1; das Präfix
  geht der Bezeichnung vor).
- „Kundennr. 66017“ — Kundennummer 66017 (Stufe 2).
- „bezüglich unserer Nummer 78432“ — nichts (Stufe 3).
- „Rechnung 2024-9981“ — nichts. Rechnungsnummern sind weder Auftrags- noch
  Kundennummern.
- „part no. 7745-B“ — nichts. Teilenummern sind weder Auftrags- noch
  Kundennummern.

**Begründung:** Das Präfix vergeben wir selbst; die Bezeichnung durch den
Kunden ist eine Angabe, die häufig verwechselt wird. Widersprechen sich
beide, gilt, was wir vergeben haben. Eine Nummer, deren Art sich aus der
Nachricht nicht ergibt, wird nicht geraten: eine falsch zugeordnete Nummer
führt zur Prüfung eines fremden Vorgangs.

**Seit:** v1.0

---

## Dringlichkeit

### R-10 — Eskalationsmerkmale nur bei ausdrücklicher Aussage

Ein Eskalationsmerkmal wird nur festgehalten, wenn der Kunde es ausdrücklich
schreibt. Es gibt vier:

- **Wiederholte Kontaktaufnahme** — der Kunde schreibt, dass er sich in
  derselben Sache bereits zuvor an uns gewandt hat („das ist jetzt die dritte
  Mail“, „ich hatte bereits vergangene Woche angefragt“).
- **Angedrohte Stornierung** — der Kunde droht, einen Auftrag zu stornieren
  oder die Geschäftsbeziehung zu beenden, falls etwas nicht geschieht (R-11).
- **Produktionsstillstand** — der Kunde schreibt, dass sein eigener Betrieb
  stillsteht oder blockiert ist („unsere Montagelinie steht seit Montag
  still“).
- **Angekündigte rechtliche Schritte** — der Kunde erwähnt einen Anwalt,
  rechtliche Schritte oder förmliche Ansprüche („geben wir die Sache an
  unseren Rechtsanwalt ab“).

Großschreibung, Ausrufezeichen, das Wort „dringend“, ein scharfer Ton oder
auffallende Unhöflichkeit sind keine Eskalationsmerkmale.

Eine Nachricht, die in Versalien und mit drei Ausrufezeichen die Zusendung
eines Katalogs verlangt, ist kein Eskalationsfall. Eine sachlich und höflich
formulierte Nachricht, in der steht, dass die Montagelinie des Kunden seit
Montag stillsteht, ist einer.

**Begründung:** Wer lauter schreibt, hat nicht das dringendere Problem.
Würden wir nach Tonfall priorisieren, käme der höfliche Kunde mit dem
stehenden Band hinter den ungeduldigen Kunden mit der Katalogbestellung. Der
Ton ist von Person zu Person verschieden, der geschilderte Sachverhalt nicht.

**Seit:** v1.0

### R-11 — Eine ausgesprochene Stornierung ist keine Drohung

Eine angedrohte Stornierung ist bedingt und in die Zukunft gerichtet: der
Kunde kündigt an, zu stornieren oder die Geschäftsbeziehung zu beenden, falls
etwas nicht geschieht.

„Ich brauche das bis morgen geklärt, sonst storniere ich den nächsten
Auftrag.“ — Angedrohte Stornierung.

Erklärt der Kunde die Stornierung bereits, ist das keine Drohung, sondern ein
Anliegen der Kategorie Stornierung.

„Wir möchten die Bestellung daher komplett stornieren.“ — Keine Drohung.

**Begründung:** Eine Drohung ist ein Warnsignal: die Geschäftsbeziehung steht
auf dem Spiel, und es muss schnell gehandelt werden, um etwas abzuwenden.
Eine erklärte Stornierung ist ein Vorgang, der sachlich bearbeitet wird.

**Seit:** v1.0

### R-12 — Fristen

Eine Frist ist ein Zeitpunkt, bis zu dem der Kunde von uns eine Antwort oder
eine Klärung verlangt. Sie wird im Wortlaut der Nachricht festgehalten
(R-02).

„Bitte bestätigen Sie uns die Stornierung bis Freitag“ enthält eine Frist.
„Sollte die Gutschrift nicht bis zum 30.04. vorliegen, geben wir die Sache an
unseren Rechtsanwalt ab“ ebenfalls.

Keine Frist ist ein Datum, das etwas anderes beschreibt, auch wenn es mit
„bis“ eingeleitet wird:

- ein gewünschter Liefertermin („Lieferung bis zum 15.04.“),
- ein von uns zugesagter Termin („Sie hatten uns die Lieferung bis zum 06.06.
  zugesagt“),
- ein Ereignis, das bereits stattgefunden hat („kam letzte Woche an“, „wir
  sind zum 01.05. umgezogen“).

Ob ein Datum aus heutiger Sicht verstrichen ist, spielt keine Rolle.
Maßgeblich ist, was der Kunde zum Zeitpunkt des Schreibens verlangt. Eine
inzwischen abgelaufene Frist bleibt eine Frist.

**Begründung:** Eine vom Kunden gesetzte Frist sagt, wann er eine Reaktion
erwartet, und bestimmt die Reihenfolge der Bearbeitung. Liefertermine und
Zusagen sind Sachverhalte zum Auftrag; sie werden im Auftragsbestand geprüft,
nicht aus der Nachricht übernommen.

**Seit:** v1.0

### R-13 — Dringlichkeit

Jede Nachricht erhält eine von drei Dringlichkeitsstufen. Maßgeblich sind
ausschließlich Eskalationsmerkmale (R-10, R-11) und Fristen (R-12). Es gilt
die höchste zutreffende Stufe.

**Hoch** — die Nachricht enthält mindestens eines dieser Merkmale:

- Produktionsstillstand
- angekündigte rechtliche Schritte
- angedrohte Stornierung

**Mittel** — keines der obigen Merkmale, aber mindestens eines davon:

- eine Frist (R-12)
- wiederholte Kontaktaufnahme

**Niedrig** — alle übrigen Nachrichten.

Merkmale addieren sich nicht. Eine wiederholte Kontaktaufnahme mit Frist
bleibt mittel; hoch wird eine Nachricht nur durch eines der drei Merkmale der
obersten Stufe.

Die Kategorie beeinflusst die Dringlichkeit nicht. Eine Reklamation ohne
Eskalationsmerkmal und ohne Frist ist niedrig, eine Dokumentenanforderung mit
Frist ist mittel.

Beispiele:

- „Unsere Montagelinie steht deshalb seit Montag still.“ — Hoch.
- „Das ist jetzt die dritte Mail … ich brauche das bis morgen geklärt, sonst
  storniere ich den nächsten Auftrag.“ — Hoch. Die angedrohte Stornierung
  entscheidet; Frist und wiederholte Kontaktaufnahme ändern daran nichts.
- „Bitte bestätigen Sie die Stornierung bis Freitag.“ — Mittel.
- „Ich hatte bereits vergangene Woche angefragt …“, ohne Frist — Mittel.
- „SEHR DRINGEND!!! Bitte schicken Sie mir den Katalog.“ — Niedrig (R-10).

**Begründung:** Die oberste Stufe erfasst Lagen, in denen dem Kunden oder der
Geschäftsbeziehung ein Schaden unmittelbar droht oder bereits eingetreten
ist. Die mittlere Stufe erfasst Nachrichten, bei denen der Kunde eine
Reaktion zu einem bestimmten Zeitpunkt erwartet oder bereits vergeblich
gewartet hat. Die Stufen sind bewusst einfach gehalten: jede Einstufung lässt
sich an einem einzelnen, ausdrücklich genannten Merkmal nachprüfen.

**Seit:** v1.0

---

## Bekannte Lücken

Bewusst nicht geregelt, jeweils mit Begründung.

- **Lieferantenkorrespondenz.** Nachrichten von Unternehmen, von denen wir
  beziehen, zu einem laufenden Beschaffungsvorgang — etwa eine
  Auftragsbestätigung oder ein Lieferavis zu einer von uns erteilten
  Bestellung — sind fachlich weder Werbung noch Kundenkorrespondenz. Es gibt
  derzeit keine passende Kategorie; nach R-03 würden sie als Werbung
  eingestuft. Das ist fachlich falsch und bewusst zurückgestellt: die
  Erweiterung wird erst vorgenommen, wenn ihre Auswirkung auf die
  Bewertungsgüte messbar ist.

- **Überschrittene Zusagen.** Beruft sich ein Kunde auf einen von uns
  zugesagten und inzwischen überschrittenen Termin, ist die Nachricht
  fachlich dringender. Das wird nicht aus dem Text abgeleitet, weil der
  zugesagte Termin im Auftragsbestand steht und dort zuverlässiger geprüft
  werden kann. Die Ableitung gehört in die Auswertung der Auftragsdaten.

- **Nähe einer Frist.** Eine Frist hebt die Dringlichkeit auf mittel,
  unabhängig davon, ob sie morgen oder in drei Monaten abläuft. Eine
  Abstufung nach Nähe setzt voraus, dass Fristen in ein Kalenderdatum
  umgerechnet werden; das ist zurückgestellt.

- **Beschwerden ohne gewünschte Maßnahme.** Wie auf eine Beschwerde reagiert
  wird, in der der Kunde keine Maßnahme verlangt — etwa mit einem proaktiven
  Angebot —, regelt dieses Dokument nicht. Das betrifft die Formulierung der
  Antwort, nicht die Bewertung der Nachricht.

- **Privatpersonen.** Wir beliefern ausschließlich Geschäftskunden. Wie
  Nachrichten von Privatpersonen zu bewerten sind, ist nicht geregelt.

---

## Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| v1.0 | 21.09.2026 | Erstfassung |
