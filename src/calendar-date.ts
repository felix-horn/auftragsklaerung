// The calendar day in Germany. Germany has one time zone, Europe/Berlin:
// UTC+1 in winter, UTC+2 in summer. Intl knows when the clocks change.
//
// The locale ("en-US") only decides the order of the parts, their
// separators and the digits. formatToParts names every part, so the order
// and separators don't matter here; en-US writes the digits 0–9.
const germanCalendar = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The calendar day in Germany at the given instant, as "YYYY-MM-DD", the
 * form of the ERP's dates. R-17's "Tag des Abgleichs" is this day: an entry
 * point passes `toCalendarDateInGermany(new Date())` as the lookup day.
 *
 * Not `instant.toISOString().slice(0, 10)`: that is the day in UTC, which at
 * 00:30 in Germany is still the day before (until 01:00 in winter, until
 * 02:00 in summer).
 */
export function toCalendarDateInGermany(instant: Date): string {
  const parts = germanCalendar.formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}
