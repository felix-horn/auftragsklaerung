import { expect, test } from "vitest";
import { parseConfig } from "./config.js";

// Invented environments, passed in directly: no .env, no process.env.

test("the mock ERP's address is accepted as it is", () => {
  expect(parseConfig({ ERP_BASE_URL: "http://127.0.0.1:4100" })).toEqual({
    kind: "valid",
    config: { erpBaseUrl: "http://127.0.0.1:4100" },
  });
});

test("https with a path is accepted; a trailing slash is removed", () => {
  expect(parseConfig({ ERP_BASE_URL: "https://erp.example/api/v1/" })).toEqual({
    kind: "valid",
    config: { erpBaseUrl: "https://erp.example/api/v1" },
  });
  expect(parseConfig({ ERP_BASE_URL: "http://127.0.0.1:4100/" })).toEqual({
    kind: "valid",
    config: { erpBaseUrl: "http://127.0.0.1:4100" },
  });
});

test("other environment variables are ignored", () => {
  expect(
    parseConfig({ ERP_BASE_URL: "http://127.0.0.1:4100", HOME: "/Users/x" }),
  ).toEqual({ kind: "valid", config: { erpBaseUrl: "http://127.0.0.1:4100" } });
});

test("a missing ERP_BASE_URL is named as not set", () => {
  expect(parseConfig({})).toEqual({
    kind: "invalid",
    problems:
      "✖ is not set (add it to .env, see .env.example)\n  → at ERP_BASE_URL",
  });
});

test("an empty value, a missing scheme or another scheme is not a URL we can use", () => {
  // "ERP_BASE_URL=" in .env gives an empty string, not a missing variable.
  for (const value of ["", "127.0.0.1:4100", "localhost:4100", "ftp://erp.example", "http://"]) {
    expect(parseConfig({ ERP_BASE_URL: value })).toEqual({
      kind: "invalid",
      problems:
        "✖ must be an http or https URL, e.g. http://127.0.0.1:4100\n  → at ERP_BASE_URL",
    });
  }
});
