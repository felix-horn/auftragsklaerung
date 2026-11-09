import { expect, test } from "vitest";
import { toCalendarDateInGermany } from "./calendar-date.js";

// Instants are written in UTC ("Z"). The comment after each one gives the
// time on a clock in Germany at that instant.

test("during the day, Germany and UTC name the same day", () => {
  // 12:00 in Germany
  expect(toCalendarDateInGermany(new Date("2026-11-09T11:00:00Z"))).toBe(
    "2026-11-09",
  );
});

test("winter (UTC+1): from 00:00 in Germany it is the next day, while UTC still names the day before", () => {
  // 23:59:59 in Germany
  expect(toCalendarDateInGermany(new Date("2026-11-06T22:59:59Z"))).toBe(
    "2026-11-06",
  );
  // 00:00 in Germany
  expect(toCalendarDateInGermany(new Date("2026-11-06T23:00:00Z"))).toBe(
    "2026-11-07",
  );
  // 00:30 in Germany
  expect(toCalendarDateInGermany(new Date("2026-11-06T23:30:00Z"))).toBe(
    "2026-11-07",
  );
});

test("summer (UTC+2): the next day starts at 22:00 UTC", () => {
  // 23:59:59 in Germany
  expect(toCalendarDateInGermany(new Date("2026-07-06T21:59:59Z"))).toBe(
    "2026-07-06",
  );
  // 00:00 in Germany
  expect(toCalendarDateInGermany(new Date("2026-07-06T22:00:00Z"))).toBe(
    "2026-07-07",
  );
});

test("the nights the clocks change: the offset of that night counts", () => {
  // 00:30 on 29.03.2026, still UTC+1 (clocks go forward at 02:00)
  expect(toCalendarDateInGermany(new Date("2026-03-28T23:30:00Z"))).toBe(
    "2026-03-29",
  );
  // 00:30 on 25.10.2026, still UTC+2 (clocks go back at 03:00)
  expect(toCalendarDateInGermany(new Date("2026-10-24T22:30:00Z"))).toBe(
    "2026-10-25",
  );
  // 23:59:59 on 24.10.2026, UTC+2
  expect(toCalendarDateInGermany(new Date("2026-10-24T21:59:59Z"))).toBe(
    "2026-10-24",
  );
});

test("the year changes at midnight in Germany", () => {
  // 00:30 on 01.01.2027
  expect(toCalendarDateInGermany(new Date("2026-12-31T23:30:00Z"))).toBe(
    "2027-01-01",
  );
});

test("month and day always have two digits, as in the ERP's dates", () => {
  // 09:00 on 05.01.2027
  expect(toCalendarDateInGermany(new Date("2027-01-05T08:00:00Z"))).toBe(
    "2027-01-05",
  );
});
