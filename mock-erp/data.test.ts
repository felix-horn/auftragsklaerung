import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { z } from "zod";
import { erpDataSchema } from "./data-schema.js";

// The mock ERP refuses to start on data that breaks these rules (Module
// 4.3, part 4). This test finds the same problems earlier: with `npm test`,
// locally and in CI, without starting the server.
test("mock-erp/data.json follows the rules in mock-erp/data-schema.ts", () => {
  // new URL(…, import.meta.url): the file next to this one, wherever the
  // repo lives; the path may contain spaces.
  const text = readFileSync(new URL("./data.json", import.meta.url), "utf8");
  const result = erpDataSchema.safeParse(JSON.parse(text));
  // On failure the test shows every problem, one per line.
  expect(result.success ? "" : z.prettifyError(result.error)).toBe("");
});
